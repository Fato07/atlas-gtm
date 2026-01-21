"""HeyReach API client with rate limiting and retry logic.

Production-quality HTTP client implementing:
- X-API-KEY authentication
- Rate limiting (300 req/min) with exponential backoff
- Configurable timeout (default 30s)
- Structured JSON logging
"""

from __future__ import annotations

import os
import re
import time
from typing import Any

import httpx
from tenacity import (
    RetryCallState,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from .logging import generate_correlation_id, log_api_call
from .models import HeyReachErrorType, classify_http_error

# =============================================================================
# Configuration
# =============================================================================

HEYREACH_API_URL = "https://api.heyreach.io/api/public"
HEYREACH_API_KEY = os.getenv("HEYREACH_API_KEY")

# Rate limit: 300 requests per minute (5 per second average)
RATE_LIMIT_PER_MINUTE = 300

# Retry configuration
MAX_RETRIES = 3
RETRY_START_SECONDS = 1.0
RETRY_MAX_SECONDS = 10.0

# Timeout configuration
DEFAULT_TIMEOUT_SECONDS = 30.0


def _wait_with_retry_after(retry_state: RetryCallState) -> float:
    """Custom wait strategy that respects Retry-After header.

    Uses exponential backoff by default, but if the exception has a
    retry_after value from the Retry-After header, uses that instead.

    Args:
        retry_state: Tenacity retry state

    Returns:
        Number of seconds to wait before next retry
    """
    exception = retry_state.outcome.exception() if retry_state.outcome else None
    if isinstance(exception, HeyReachRetriableError) and exception.retry_after:
        return min(exception.retry_after, RETRY_MAX_SECONDS)

    exp_wait = wait_exponential(multiplier=RETRY_START_SECONDS, max=RETRY_MAX_SECONDS)
    return exp_wait(retry_state)


# =============================================================================
# Custom Exceptions
# =============================================================================


class HeyReachAPIError(Exception):
    """Base exception for HeyReach API errors."""

    def __init__(
        self,
        message: str,
        error_type: HeyReachErrorType = HeyReachErrorType.UNKNOWN,
        status_code: int | None = None,
    ):
        super().__init__(message)
        self.error_type = error_type
        self.status_code = status_code


class HeyReachRetriableError(HeyReachAPIError):
    """Error that should be retried (rate limit, network, timeout)."""

    def __init__(
        self,
        message: str,
        error_type: HeyReachErrorType = HeyReachErrorType.UNKNOWN,
        status_code: int | None = None,
        retry_after: float | None = None,
    ):
        super().__init__(message, error_type, status_code)
        self.retry_after = retry_after


class HeyReachNonRetriableError(HeyReachAPIError):
    """Error that should not be retried (validation, auth, not found)."""

    pass


# =============================================================================
# HeyReach API Client
# =============================================================================


class HeyReachClient:
    """HeyReach API client with rate limiting and structured logging.

    Implements:
    - X-API-KEY authentication
    - Rate limiting (300/min) with exponential backoff (max 3 retries)
    - Configurable timeout (default 30s)
    - Structured JSON logging via structlog
    """

    def __init__(self, api_key: str | None = None, timeout: float = DEFAULT_TIMEOUT_SECONDS):
        """Initialize the HeyReach client.

        Args:
            api_key: HeyReach API key. Defaults to HEYREACH_API_KEY env var.
            timeout: Request timeout in seconds.

        Raises:
            ValueError: If API key is not configured.
        """
        self.api_key = api_key or HEYREACH_API_KEY
        if not self.api_key:
            raise ValueError(
                "HeyReach API key not configured. Set HEYREACH_API_KEY environment variable."
            )

        self.timeout = timeout
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=HEYREACH_API_URL,
                headers={
                    "X-API-KEY": self.api_key,
                    "Content-Type": "application/json",
                },
                timeout=self.timeout,
            )
        return self._client

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    def _handle_response_error(
        self, response: httpx.Response, correlation_id: str
    ) -> None:
        """Handle HTTP error responses.

        Args:
            response: HTTP response object
            correlation_id: Request correlation ID

        Raises:
            HeyReachRetriableError: For retriable errors (429, 5xx, network)
            HeyReachNonRetriableError: For non-retriable errors (4xx)
        """
        status_code = response.status_code

        # Try to extract error message from response
        try:
            error_body = response.json()
            error_content = error_body.get("message") or error_body.get("error")
            if isinstance(error_content, dict):
                error_message = error_content.get("message", str(error_content))
            elif error_content:
                error_message = str(error_content)
            else:
                error_message = str(response.text)
        except Exception:
            error_message = response.text[:200] if response.text else f"HTTP {status_code}"

        error_type = classify_http_error(status_code, error_message)

        # Extract Retry-After header for rate limit responses
        retry_after: float | None = None
        if status_code == 429:
            retry_after_header = response.headers.get("Retry-After")
            if retry_after_header:
                try:
                    retry_after = float(retry_after_header)
                except ValueError:
                    retry_after = None

        # Sanitize error message
        sanitized_message = self._sanitize_error_message(error_message, error_type)

        log_api_call(
            method=response.request.method,
            path=str(response.request.url.path),
            status_code=status_code,
            error=sanitized_message,
            correlation_id=correlation_id,
            retry_after=retry_after,
        )

        if HeyReachErrorType.is_retriable(error_type):
            raise HeyReachRetriableError(sanitized_message, error_type, status_code, retry_after)
        else:
            raise HeyReachNonRetriableError(sanitized_message, error_type, status_code)

    def _sanitize_error_message(self, message: str, error_type: HeyReachErrorType) -> str:
        """Sanitize error messages to avoid exposing sensitive data.

        Args:
            message: Raw error message
            error_type: Classified error type

        Returns:
            User-friendly error message
        """
        friendly_messages = {
            HeyReachErrorType.AUTHENTICATION: "Authentication failed. Check your HeyReach API key.",
            HeyReachErrorType.PERMISSION_DENIED: "Permission denied. Check API key permissions.",
            HeyReachErrorType.RATE_LIMITED: (
                "Rate limit exceeded (300/min). Will retry automatically."
            ),
            HeyReachErrorType.SERVICE_UNAVAILABLE: (
                "HeyReach service temporarily unavailable. Please retry."
            ),
            HeyReachErrorType.NOT_FOUND: "Resource not found in HeyReach.",
            HeyReachErrorType.ACCOUNT_DISCONNECTED: "LinkedIn account is disconnected.",
            HeyReachErrorType.CAMPAIGN_NOT_ACTIVE: "Campaign is not active.",
            HeyReachErrorType.DAILY_LIMIT_REACHED: "Daily LinkedIn limit reached for this account.",
        }

        if error_type in friendly_messages:
            return friendly_messages[error_type]

        # Truncate and sanitize
        sanitized = message[:200]
        sanitized = re.sub(r"X-API-KEY[=:]\s*\S+", "X-API-KEY=[REDACTED]", sanitized, flags=re.I)
        sanitized = re.sub(r"api[_-]?key[=:]\s*\S+", "api_key=[REDACTED]", sanitized, flags=re.I)

        return sanitized

    @retry(
        retry=retry_if_exception_type(HeyReachRetriableError),
        stop=stop_after_attempt(MAX_RETRIES),
        wait=_wait_with_retry_after,
        reraise=True,
    )
    async def _request(
        self,
        method: str,
        path: str,
        correlation_id: str,
        json: dict | None = None,
        params: dict | None = None,
        retry_attempt: int = 0,
    ) -> dict:
        """Execute HTTP request with retry logic.

        Args:
            method: HTTP method
            path: API endpoint path
            correlation_id: Request correlation ID
            json: JSON body
            params: Query parameters
            retry_attempt: Current retry attempt number

        Returns:
            Parsed JSON response

        Raises:
            HeyReachRetriableError: For retriable errors
            HeyReachNonRetriableError: For non-retriable errors
        """
        client = await self._get_client()
        start_time = time.perf_counter()

        try:
            response = await client.request(method, path, json=json, params=params)
            latency_ms = (time.perf_counter() - start_time) * 1000

            if response.status_code >= 400:
                self._handle_response_error(response, correlation_id)

            log_api_call(
                method=method,
                path=path,
                status_code=response.status_code,
                latency_ms=latency_ms,
                retry_attempt=retry_attempt,
                correlation_id=correlation_id,
            )

            # Handle empty responses
            if response.status_code == 204 or not response.text:
                return {}

            return response.json()

        except httpx.TimeoutException as e:
            latency_ms = (time.perf_counter() - start_time) * 1000
            log_api_call(
                method=method,
                path=path,
                latency_ms=latency_ms,
                error="Request timeout",
                retry_attempt=retry_attempt,
                correlation_id=correlation_id,
            )
            raise HeyReachRetriableError(
                "Request timed out. Please retry.",
                HeyReachErrorType.TIMEOUT,
            ) from e

        except httpx.NetworkError as e:
            latency_ms = (time.perf_counter() - start_time) * 1000
            log_api_call(
                method=method,
                path=path,
                latency_ms=latency_ms,
                error="Network error",
                retry_attempt=retry_attempt,
                correlation_id=correlation_id,
            )
            raise HeyReachRetriableError(
                "Network error connecting to HeyReach. Please retry.",
                HeyReachErrorType.NETWORK_ERROR,
            ) from e

    async def get(self, path: str, correlation_id: str | None = None, **kwargs: Any) -> dict:
        """Execute GET request."""
        corr_id = correlation_id or generate_correlation_id()
        return await self._request("GET", path, corr_id, **kwargs)

    async def post(self, path: str, correlation_id: str | None = None, **kwargs: Any) -> dict:
        """Execute POST request."""
        corr_id = correlation_id or generate_correlation_id()
        return await self._request("POST", path, corr_id, **kwargs)

    async def patch(self, path: str, correlation_id: str | None = None, **kwargs: Any) -> dict:
        """Execute PATCH request."""
        corr_id = correlation_id or generate_correlation_id()
        return await self._request("PATCH", path, corr_id, **kwargs)

    async def delete(self, path: str, correlation_id: str | None = None, **kwargs: Any) -> dict:
        """Execute DELETE request."""
        corr_id = correlation_id or generate_correlation_id()
        return await self._request("DELETE", path, corr_id, **kwargs)


# Global client instance (lazy initialization)
_heyreach_client: HeyReachClient | None = None


def get_heyreach_client() -> HeyReachClient:
    """Get or create the global HeyReach client."""
    global _heyreach_client
    if _heyreach_client is None:
        _heyreach_client = HeyReachClient()
    return _heyreach_client
