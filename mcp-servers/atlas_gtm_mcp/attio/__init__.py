"""Attio MCP tools for CRM operations.

Production-quality implementation with:
- Rate limiting with exponential backoff (FR-002)
- ToolError for all error conditions (FR-003, FR-016)
- Structured JSON logging (FR-005)
- Pipeline stage validation (FR-014, FR-015)
- Input validation (FR-019, FR-020, FR-021)
"""

from __future__ import annotations

import os
import time
from typing import Any

import httpx
from fastmcp import FastMCP
from fastmcp.exceptions import ToolError
from tenacity import (
    RetryCallState,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from .logging import (
    generate_correlation_id,
    log,
    log_api_call,
    log_tool_error,
    log_tool_result,
)
from .models import (
    ActivityType,
    AttioErrorType,
    PipelineStage,
    VALID_STAGE_TRANSITIONS,
    classify_http_error,
    validate_email,
    validate_list_id,
    validate_non_empty_string,
    validate_record_id,
    validate_stage_transition,
)

# =============================================================================
# Configuration
# =============================================================================

ATTIO_API_URL = "https://api.attio.com/v2"
ATTIO_API_KEY = os.getenv("ATTIO_API_KEY")
ATTIO_PIPELINE_LIST_ID = os.getenv("ATTIO_PIPELINE_LIST_ID")

# Retry configuration per FR-002
MAX_RETRIES = 3
RETRY_START_SECONDS = 1.0
RETRY_MAX_SECONDS = 10.0

# Timeout configuration per FR-004
DEFAULT_TIMEOUT_SECONDS = 30.0

# Module-level cache for list status mappings (C3)
# Maps list_id -> {status_name -> status_id}
_list_status_cache: dict[str, dict[str, str]] = {}


def _wait_with_retry_after(retry_state: RetryCallState) -> float:
    """Custom wait strategy that respects Retry-After header (C2).

    Uses exponential backoff by default, but if the exception has a
    retry_after value from the Retry-After header, uses that instead.

    Args:
        retry_state: Tenacity retry state

    Returns:
        Number of seconds to wait before next retry
    """
    # Check if the exception has a retry_after value
    exception = retry_state.outcome.exception() if retry_state.outcome else None
    if isinstance(exception, AttioRetriableError) and exception.retry_after:
        # Use Retry-After header value, capped at max
        return min(exception.retry_after, RETRY_MAX_SECONDS)

    # Fall back to exponential backoff
    exp_wait = wait_exponential(multiplier=RETRY_START_SECONDS, max=RETRY_MAX_SECONDS)
    return exp_wait(retry_state)


# =============================================================================
# Custom Exceptions
# =============================================================================


class AttioAPIError(Exception):
    """Base exception for Attio API errors."""

    def __init__(
        self,
        message: str,
        error_type: AttioErrorType = AttioErrorType.UNKNOWN,
        status_code: int | None = None,
    ):
        super().__init__(message)
        self.error_type = error_type
        self.status_code = status_code


class AttioRetriableError(AttioAPIError):
    """Error that should be retried (rate limit, network, timeout)."""

    def __init__(
        self,
        message: str,
        error_type: AttioErrorType = AttioErrorType.UNKNOWN,
        status_code: int | None = None,
        retry_after: float | None = None,
    ):
        super().__init__(message, error_type, status_code)
        self.retry_after = retry_after  # Seconds to wait before retry (from Retry-After header)


class AttioNonRetriableError(AttioAPIError):
    """Error that should not be retried (validation, auth, not found)."""

    pass


# =============================================================================
# Attio API Client with Rate Limiting
# =============================================================================


class AttioClient:
    """Attio API client with rate limiting and structured logging.

    Implements:
    - FR-001: Bearer token authentication
    - FR-002: Rate limiting with exponential backoff (max 3 retries)
    - FR-003: ToolError conversion for user-friendly messages
    - FR-004: Configurable timeout (default 30s)
    - FR-005: Structured JSON logging via structlog
    """

    def __init__(self, api_key: str | None = None, timeout: float = DEFAULT_TIMEOUT_SECONDS):
        """Initialize the Attio client.

        Args:
            api_key: Attio API key. Defaults to ATTIO_API_KEY env var.
            timeout: Request timeout in seconds.

        Raises:
            ToolError: If API key is not configured.
        """
        self.api_key = api_key or ATTIO_API_KEY
        if not self.api_key:
            raise ToolError(
                "Attio API key not configured. Set ATTIO_API_KEY environment variable."
            )

        self.timeout = timeout
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=ATTIO_API_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
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
            AttioRetriableError: For retriable errors (429, 5xx, network)
            AttioNonRetriableError: For non-retriable errors (4xx)
        """
        status_code = response.status_code
        error_type = classify_http_error(status_code)

        # Try to extract error message from response
        try:
            error_body = response.json()
            # Handle nested error structures like {"error": {"message": "..."}}
            error_content = error_body.get("message") or error_body.get("error")
            if isinstance(error_content, dict):
                error_message = error_content.get("message", str(error_content))
            elif error_content:
                error_message = str(error_content)
            else:
                error_message = str(response.text)
        except Exception:
            error_message = response.text[:200] if response.text else f"HTTP {status_code}"

        # Extract Retry-After header for rate limit responses (C2)
        retry_after: float | None = None
        if status_code == 429:
            retry_after_header = response.headers.get("Retry-After")
            if retry_after_header:
                try:
                    # Retry-After can be seconds (integer) or HTTP-date
                    retry_after = float(retry_after_header)
                except ValueError:
                    # If it's an HTTP-date, use default backoff
                    retry_after = None

        # Sanitize error message (FR-018)
        sanitized_message = self._sanitize_error_message(error_message, error_type)

        log_api_call(
            method=response.request.method,
            path=str(response.request.url.path),
            status_code=status_code,
            error=sanitized_message,
            correlation_id=correlation_id,
            retry_after=retry_after,
        )

        if AttioErrorType.is_retriable(error_type):
            raise AttioRetriableError(sanitized_message, error_type, status_code, retry_after)
        else:
            raise AttioNonRetriableError(sanitized_message, error_type, status_code)

    def _sanitize_error_message(self, message: str, error_type: AttioErrorType) -> str:
        """Sanitize error messages to avoid exposing sensitive data (FR-018).

        Args:
            message: Raw error message
            error_type: Classified error type

        Returns:
            User-friendly error message
        """
        # Map error types to user-friendly messages
        friendly_messages = {
            AttioErrorType.AUTHENTICATION: "Authentication failed. Check your Attio API key.",
            AttioErrorType.PERMISSION_DENIED: "Permission denied. Check API key permissions.",
            AttioErrorType.RATE_LIMITED: "Rate limit exceeded. Will retry automatically.",
            AttioErrorType.SERVICE_UNAVAILABLE: (
                "Attio service temporarily unavailable. Please retry."
            ),
            AttioErrorType.NOT_FOUND: "Resource not found in Attio.",
            AttioErrorType.CONFLICT: "Conflict: resource already exists or was modified.",
        }

        if error_type in friendly_messages:
            return friendly_messages[error_type]

        # For other errors, truncate and sanitize
        sanitized = message[:200]
        # Remove potential sensitive data patterns
        import re

        sanitized = re.sub(r"Bearer [A-Za-z0-9\-._~+/]+=*", "Bearer [REDACTED]", sanitized)
        sanitized = re.sub(r"api[_-]?key[=:]\s*\S+", "api_key=[REDACTED]", sanitized, flags=re.I)

        return sanitized

    @retry(
        retry=retry_if_exception_type(AttioRetriableError),
        stop=stop_after_attempt(MAX_RETRIES),
        wait=_wait_with_retry_after,  # Custom wait that respects Retry-After header (C2)
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
            AttioRetriableError: For retriable errors
            AttioNonRetriableError: For non-retriable errors
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
            raise AttioRetriableError(
                "Request timed out. Please retry.",
                AttioErrorType.TIMEOUT,
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
            raise AttioRetriableError(
                "Network error connecting to Attio. Please retry.",
                AttioErrorType.NETWORK_ERROR,
            ) from e

    async def get(self, path: str, correlation_id: str, **kwargs) -> dict:
        """Execute GET request."""
        return await self._request("GET", path, correlation_id, **kwargs)

    async def post(self, path: str, correlation_id: str, **kwargs) -> dict:
        """Execute POST request."""
        return await self._request("POST", path, correlation_id, **kwargs)

    async def patch(self, path: str, correlation_id: str, **kwargs) -> dict:
        """Execute PATCH request."""
        return await self._request("PATCH", path, correlation_id, **kwargs)


# Global client instance (lazy initialization)
_attio_client: AttioClient | None = None


def _get_attio_client() -> AttioClient:
    """Get or create the global Attio client."""
    global _attio_client
    if _attio_client is None:
        _attio_client = AttioClient()
    return _attio_client


def _convert_to_tool_error(e: Exception) -> ToolError:
    """Convert exceptions to user-friendly ToolError (FR-003).

    Args:
        e: Original exception

    Returns:
        ToolError with user-friendly message
    """
    if isinstance(e, ToolError):
        return e
    if isinstance(e, AttioAPIError):
        return ToolError(str(e))
    if isinstance(e, ValueError):
        return ToolError(f"Validation error: {e}")
    # Generic fallback
    return ToolError(f"Attio operation failed: {type(e).__name__}")


def _get_pipeline_list_id() -> str:
    """Get the configured pipeline list ID.

    Returns:
        The pipeline list ID

    Raises:
        ToolError: If not configured
    """
    list_id = ATTIO_PIPELINE_LIST_ID
    if not list_id:
        raise ToolError(
            "Pipeline list ID not configured. Set ATTIO_PIPELINE_LIST_ID environment variable."
        )
    return list_id


# =============================================================================
# MCP Tool Registration
# =============================================================================


def register_attio_tools(mcp: FastMCP) -> None:
    """Register all Attio CRM tools with the MCP server.

    Tools:
    - find_person: Search by email (FR-006)
    - create_person: Create new record (FR-007)
    - update_person: Update existing record (FR-008)
    - update_pipeline_stage: Move in pipeline (FR-009)
    - add_activity: Log interaction (FR-010)
    - create_task: Create follow-up task (FR-011)
    - get_pipeline_records: Query pipeline (FR-012)
    - get_record_activities: Get activity history (FR-013)
    """

    # =========================================================================
    # FR-006: find_person
    # =========================================================================

    @mcp.tool()
    async def find_person(email: str) -> dict | None:
        """
        Find a person in Attio CRM by email address.

        Args:
            email: Email address to search for

        Returns:
            Person record with all attributes, or None if not found

        Raises:
            ToolError: On validation or API errors
        """
        tool_name = "find_person"
        params = {"email": email}
        start_time = time.perf_counter()
        correlation_id = generate_correlation_id()

        try:
            # Input validation (FR-019)
            if not validate_email(email):
                raise ToolError(f"Invalid email format: {email}")

            client = _get_attio_client()

            response = await client.post(
                "/objects/people/records/query",
                correlation_id,
                json={
                    "filter": {
                        "email_addresses": {"contains": email.strip().lower()}
                    }
                },
            )

            records = response.get("data", [])
            result = records[0] if records else None

            log_tool_result(tool_name, params, result, start_time, correlation_id)
            return result

        except ToolError:
            raise
        except Exception as e:
            log_tool_error(tool_name, params, e, start_time, correlation_id)
            raise _convert_to_tool_error(e) from e

    # =========================================================================
    # FR-007: create_person
    # =========================================================================

    @mcp.tool()
    async def create_person(
        email: str,
        name: str,
        company: str | None = None,
        title: str | None = None,
        linkedin_url: str | None = None,
    ) -> dict:
        """
        Create a new person in Attio CRM.

        Args:
            email: Email address (required)
            name: Full name (required)
            company: Company name (optional)
            title: Job title (optional)
            linkedin_url: LinkedIn profile URL (optional)

        Returns:
            Created person record

        Raises:
            ToolError: On validation or API errors
        """
        tool_name = "create_person"
        params = {
            "email": email,
            "name": name,
            "company": company,
            "title": title,
            "linkedin_url": linkedin_url,
        }
        start_time = time.perf_counter()
        correlation_id = generate_correlation_id()

        try:
            # Input validation (FR-019, FR-020)
            if not validate_email(email):
                raise ToolError(f"Invalid email format: {email}")

            name = validate_non_empty_string(name, "name")

            client = _get_attio_client()

            data: dict[str, Any] = {
                "data": {
                    "values": {
                        "email_addresses": [{"email_address": email.strip().lower()}],
                        "name": [{"full_name": name}],
                    }
                }
            }

            if title:
                data["data"]["values"]["job_title"] = [{"value": title.strip()}]

            response = await client.post(
                "/objects/people/records",
                correlation_id,
                json=data,
            )

            result = response.get("data")
            log_tool_result(tool_name, params, result, start_time, correlation_id)
            return result

        except ToolError:
            raise
        except Exception as e:
            log_tool_error(tool_name, params, e, start_time, correlation_id)
            raise _convert_to_tool_error(e) from e

    # =========================================================================
    # FR-008: update_person
    # =========================================================================

    @mcp.tool()
    async def update_person(
        record_id: str,
        fields: dict,
    ) -> dict:
        """
        Update a person record in Attio CRM.

        Args:
            record_id: The Attio record ID
            fields: Dictionary of fields to update

        Returns:
            Updated person record

        Raises:
            ToolError: On validation or API errors
        """
        tool_name = "update_person"
        params = {"record_id": record_id, "fields": fields}
        start_time = time.perf_counter()
        correlation_id = generate_correlation_id()

        try:
            # Input validation (FR-020)
            if not validate_record_id(record_id):
                raise ToolError("Invalid record_id format")

            if not fields or not isinstance(fields, dict):
                raise ToolError("fields must be a non-empty dictionary")

            client = _get_attio_client()

            data = {"data": {"values": fields}}
            response = await client.patch(
                f"/objects/people/records/{record_id.strip()}",
                correlation_id,
                json=data,
            )

            result = response.get("data")
            log_tool_result(tool_name, params, result, start_time, correlation_id)
            return result

        except ToolError:
            raise
        except Exception as e:
            log_tool_error(tool_name, params, e, start_time, correlation_id)
            raise _convert_to_tool_error(e) from e

    # =========================================================================
    # FR-009: update_pipeline_stage
    # =========================================================================

    async def _get_list_status_mapping(
        client: AttioClient,
        list_id: str,
        correlation_id: str,
    ) -> dict[str, str]:
        """Get status name to status_id mapping for a list.

        Fetches list schema to extract status attribute options.
        Results are cached per list_id.

        Args:
            client: Attio API client
            list_id: The list/pipeline ID
            correlation_id: Request correlation ID

        Returns:
            Dict mapping status names (lowercase) to status_ids
        """
        if list_id in _list_status_cache:
            return _list_status_cache[list_id]

        # Fetch list details to get attribute configuration
        response = await client.get(f"/lists/{list_id}", correlation_id)
        list_data = response.get("data", {})

        # Find the status attribute and extract options
        status_mapping: dict[str, str] = {}
        attributes = list_data.get("attributes", [])

        for attr in attributes:
            if attr.get("type") == "status":
                # Found the status attribute - extract its options
                for status in attr.get("config", {}).get("statuses", []):
                    status_name = status.get("title", "").lower().replace(" ", "_")
                    status_id = status.get("id", {}).get("status_id")
                    if status_name and status_id:
                        status_mapping[status_name] = status_id
                break

        _list_status_cache[list_id] = status_mapping
        return status_mapping

    @mcp.tool()
    async def update_pipeline_stage(
        record_id: str,
        stage: str,
        list_id: str | None = None,
        force: bool = False,
    ) -> dict:
        """
        Update a record's pipeline stage in Attio.

        Stage transitions are validated to ensure workflow integrity:
        - new_reply → qualifying, closed_lost
        - qualifying → meeting_scheduled, closed_lost
        - meeting_scheduled → meeting_held, closed_lost
        - meeting_held → proposal, closed_lost
        - proposal → closed_won, closed_lost
        - closed_won, closed_lost are terminal states

        Args:
            record_id: The record ID
            stage: New stage name (must be valid pipeline stage)
            list_id: The pipeline/list ID (optional, uses ATTIO_PIPELINE_LIST_ID if not provided)
            force: If True, skip transition validation (use with caution)

        Returns:
            Updated entry with previous_stage and new_stage in response

        Raises:
            ToolError: On validation errors, invalid transition, or if record not in pipeline
        """
        tool_name = "update_pipeline_stage"
        params = {"record_id": record_id, "stage": stage, "list_id": list_id, "force": force}
        start_time = time.perf_counter()
        correlation_id = generate_correlation_id()

        try:
            # Input validation (FR-020)
            if not validate_record_id(record_id):
                raise ToolError("Invalid record_id format")

            # Pipeline stage validation (FR-014, FR-015)
            if not PipelineStage.validate(stage):
                valid_stages = PipelineStage.values()
                raise ToolError(
                    f"Invalid stage: '{stage}'. Valid stages: {valid_stages}"
                )

            # Get list ID
            pipeline_list_id = list_id or _get_pipeline_list_id()
            if not validate_list_id(pipeline_list_id):
                raise ToolError("Invalid list_id format")

            client = _get_attio_client()

            # First find the entry in the list
            response = await client.post(
                f"/lists/{pipeline_list_id}/entries/query",
                correlation_id,
                json={"filter": {"record_id": record_id.strip()}},
            )

            entries = response.get("data", [])
            if not entries:
                raise ToolError(
                    f"Record {record_id} not found in pipeline. "
                    "Add the record to the pipeline first."
                )

            entry = entries[0]
            entry_id = entry["id"]["entry_id"]

            # Get status mapping to find status_id for the stage name
            status_mapping = await _get_list_status_mapping(
                client, pipeline_list_id, correlation_id
            )

            # Create reverse mapping (status_id -> stage_name)
            status_id_to_name = {v: k for k, v in status_mapping.items()}

            # Get current stage from entry values
            current_stage = None
            entry_values = entry.get("entry_values", {})
            status_values = entry_values.get("status", [])
            if status_values and len(status_values) > 0:
                current_status_id = status_values[0].get("status")
                current_stage = status_id_to_name.get(current_status_id)

            # Validate stage transition (unless force=True or no current stage)
            target_stage = stage.lower()
            if current_stage and not force:
                if not validate_stage_transition(current_stage, target_stage):
                    allowed = VALID_STAGE_TRANSITIONS.get(current_stage, [])
                    raise ToolError(
                        f"Invalid stage transition: '{current_stage}' → '{target_stage}'. "
                        f"Allowed transitions from '{current_stage}': {allowed}. "
                        f"Use force=True to override."
                    )

            status_id = status_mapping.get(target_stage)
            if not status_id:
                available_statuses = list(status_mapping.keys())
                raise ToolError(
                    f"Stage '{stage}' not found in list configuration. "
                    f"Available statuses: {available_statuses}"
                )

            # Log the transition
            log.info(
                "pipeline_stage_transition",
                record_id=record_id,
                from_stage=current_stage,
                to_stage=target_stage,
                forced=force,
                correlation_id=correlation_id,
            )

            # Update using correct entry_values structure for status attributes
            response = await client.patch(
                f"/lists/{pipeline_list_id}/entries/{entry_id}",
                correlation_id,
                json={
                    "data": {
                        "entry_values": {
                            "status": [
                                {
                                    "status": status_id,
                                }
                            ]
                        }
                    }
                },
            )

            result = response.get("data")
            # Add transition info to result
            if result:
                result["_transition"] = {
                    "previous_stage": current_stage,
                    "new_stage": target_stage,
                    "forced": force,
                }

            log_tool_result(tool_name, params, result, start_time, correlation_id)
            return result

        except ToolError:
            raise
        except Exception as e:
            log_tool_error(tool_name, params, e, start_time, correlation_id)
            raise _convert_to_tool_error(e) from e

    # =========================================================================
    # FR-010: add_activity
    # =========================================================================

    @mcp.tool()
    async def add_activity(
        record_id: str,
        activity_type: str,
        content: str,
        parent_object: str = "people",
        metadata: dict | None = None,
    ) -> dict:
        """
        Add an activity/note to a record in Attio using the Notes API.

        Args:
            record_id: The record ID to add activity to
            activity_type: Type of activity (note, email, call, meeting)
            content: Activity content/description
            parent_object: Object type the record belongs to (default: "people")
            metadata: Optional metadata dict to include with the activity (e.g., email_subject, call_duration)

        Returns:
            Created note record

        Raises:
            ToolError: On validation or API errors
        """
        tool_name = "add_activity"
        params = {
            "record_id": record_id,
            "activity_type": activity_type,
            "content": content[:100] + "..." if len(content) > 100 else content,
            "parent_object": parent_object,
            "has_metadata": metadata is not None,
        }
        start_time = time.perf_counter()
        correlation_id = generate_correlation_id()

        try:
            # Input validation (FR-020, FR-021)
            if not validate_record_id(record_id):
                raise ToolError("Invalid record_id format")

            if not ActivityType.validate(activity_type):
                valid_types = ActivityType.values()
                raise ToolError(
                    f"Invalid activity_type: '{activity_type}'. Valid types: {valid_types}"
                )

            content = validate_non_empty_string(content, "content")

            # Validate metadata if provided
            if metadata is not None and not isinstance(metadata, dict):
                raise ToolError("metadata must be a dictionary")

            client = _get_attio_client()

            # Build title with metadata context if available
            title = f"{activity_type.capitalize()}: Activity Log"
            if metadata:
                # Include key metadata in title for better searchability
                if "subject" in metadata:
                    title = f"{activity_type.capitalize()}: {metadata['subject']}"
                elif "email_subject" in metadata:
                    title = f"{activity_type.capitalize()}: {metadata['email_subject']}"

            # Use Attio Notes API (v2/notes) instead of non-existent /activities
            data: dict[str, Any] = {
                "data": {
                    "parent_object": parent_object,
                    "parent_record_id": record_id.strip(),
                    "title": title,
                    "format": "plaintext",
                    "content": content,
                }
            }

            # Append metadata to content as structured footer if provided
            if metadata:
                metadata_lines = [f"\n\n---\nMetadata:"]
                for key, value in metadata.items():
                    metadata_lines.append(f"  {key}: {value}")
                data["data"]["content"] = content + "\n".join(metadata_lines)

            response = await client.post("/notes", correlation_id, json=data)

            result = response.get("data")
            log_tool_result(tool_name, params, result, start_time, correlation_id)
            return result

        except ToolError:
            raise
        except Exception as e:
            log_tool_error(tool_name, params, e, start_time, correlation_id)
            raise _convert_to_tool_error(e) from e

    # =========================================================================
    # FR-011: create_task
    # =========================================================================

    @mcp.tool()
    async def create_task(
        record_id: str,
        content: str,
        deadline_at: str | None = None,
        assignee_id: str | None = None,
        target_object: str = "people",
    ) -> dict:
        """
        Create a task linked to a record in Attio.

        Args:
            record_id: The record ID to link the task to
            content: Task content/description (required)
            deadline_at: Deadline in ISO format (e.g., 2024-12-31T15:00:00.000Z)
            assignee_id: Workspace member ID to assign the task to
            target_object: Object type the record belongs to (default: "people")

        Returns:
            Created task record

        Raises:
            ToolError: On validation or API errors
        """
        tool_name = "create_task"
        params = {
            "record_id": record_id,
            "content": content[:100] + "..." if len(content) > 100 else content,
            "deadline_at": deadline_at,
            "assignee_id": assignee_id,
            "target_object": target_object,
        }
        start_time = time.perf_counter()
        correlation_id = generate_correlation_id()

        try:
            # Input validation (FR-020)
            if not validate_record_id(record_id):
                raise ToolError("Invalid record_id format")

            content = validate_non_empty_string(content, "content")

            # Validate deadline_at format if provided
            if deadline_at:
                import re

                iso_date_regex = re.compile(
                    r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$"
                )
                if not iso_date_regex.match(deadline_at.strip()):
                    raise ToolError(
                        "deadline_at must be in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS.sssZ)"
                    )

            client = _get_attio_client()

            # Use correct Attio Tasks API structure
            data: dict[str, Any] = {
                "data": {
                    "content": content,
                    "format": "plaintext",
                    "linked_records": [
                        {
                            "target_object": target_object,
                            "target_record_id": record_id.strip(),
                        }
                    ],
                }
            }

            if deadline_at:
                data["data"]["deadline_at"] = deadline_at.strip()
            if assignee_id:
                data["data"]["assignees"] = [
                    {"referenced_actor_type": "workspace-member", "referenced_actor_id": assignee_id.strip()}
                ]

            response = await client.post("/tasks", correlation_id, json=data)

            result = response.get("data")
            log_tool_result(tool_name, params, result, start_time, correlation_id)
            return result

        except ToolError:
            raise
        except Exception as e:
            log_tool_error(tool_name, params, e, start_time, correlation_id)
            raise _convert_to_tool_error(e) from e

    # =========================================================================
    # FR-012: get_pipeline_records
    # =========================================================================

    @mcp.tool()
    async def get_pipeline_records(
        stage: str | None = None,
        limit: int = 50,
        offset: int = 0,
        list_id: str | None = None,
    ) -> dict:
        """
        Get records from a pipeline/list with pagination support.

        Args:
            stage: Optional stage to filter by (must be valid pipeline stage)
            limit: Maximum records to return (default 50, max 100)
            offset: Number of records to skip for pagination (default 0)
            list_id: The pipeline/list ID (optional, uses ATTIO_PIPELINE_LIST_ID if not provided)

        Returns:
            Dict with:
                - data: List of records in the pipeline
                - pagination: Dict with offset, limit, has_more, total (if available)

        Raises:
            ToolError: On validation or API errors
        """
        tool_name = "get_pipeline_records"
        params = {"stage": stage, "limit": limit, "offset": offset, "list_id": list_id}
        start_time = time.perf_counter()
        correlation_id = generate_correlation_id()

        try:
            # Validate stage if provided (FR-015)
            if stage and not PipelineStage.validate(stage):
                valid_stages = PipelineStage.values()
                raise ToolError(
                    f"Invalid stage: '{stage}'. Valid stages: {valid_stages}"
                )

            # Validate limit
            if not isinstance(limit, int) or limit < 1 or limit > 100:
                raise ToolError("limit must be between 1 and 100")

            # Validate offset
            if not isinstance(offset, int) or offset < 0:
                raise ToolError("offset must be a non-negative integer")

            # Get list ID
            pipeline_list_id = list_id or _get_pipeline_list_id()
            if not validate_list_id(pipeline_list_id):
                raise ToolError("Invalid list_id format")

            client = _get_attio_client()

            query: dict[str, Any] = {"limit": limit, "offset": offset}
            if stage:
                query["filter"] = {"stage": stage}

            response = await client.post(
                f"/lists/{pipeline_list_id}/entries/query",
                correlation_id,
                json=query,
            )

            records = response.get("data", [])

            # Build pagination response
            result = {
                "data": records,
                "pagination": {
                    "offset": offset,
                    "limit": limit,
                    "count": len(records),
                    "has_more": len(records) == limit,  # Heuristic: if we got full page, there might be more
                },
            }

            log_tool_result(tool_name, params, result, start_time, correlation_id)
            return result

        except ToolError:
            raise
        except Exception as e:
            log_tool_error(tool_name, params, e, start_time, correlation_id)
            raise _convert_to_tool_error(e) from e

    # =========================================================================
    # FR-013: get_record_activities
    # =========================================================================

    @mcp.tool()
    async def get_record_activities(
        record_id: str,
        limit: int = 20,
        parent_object: str = "people",
        sort: str = "created_at:desc",
    ) -> list[dict]:
        """
        Get notes/activities for a record using the Attio Notes API.

        Args:
            record_id: The record ID
            limit: Maximum notes to return (default 20, max 100)
            parent_object: Object type the record belongs to (default: "people")
            sort: Sort order - "created_at:asc" or "created_at:desc" (default: "created_at:desc" for newest first)

        Returns:
            List of notes/activities for the record

        Raises:
            ToolError: On validation or API errors
        """
        tool_name = "get_record_activities"
        params = {"record_id": record_id, "limit": limit, "parent_object": parent_object, "sort": sort}
        start_time = time.perf_counter()
        correlation_id = generate_correlation_id()

        try:
            # Input validation (FR-020)
            if not validate_record_id(record_id):
                raise ToolError("Invalid record_id format")

            # Validate limit
            if not isinstance(limit, int) or limit < 1 or limit > 100:
                raise ToolError("limit must be between 1 and 100")

            # Validate sort parameter
            valid_sorts = ["created_at:asc", "created_at:desc"]
            if sort not in valid_sorts:
                raise ToolError(f"Invalid sort: '{sort}'. Valid options: {valid_sorts}")

            client = _get_attio_client()

            # Parse sort parameter
            sort_field, sort_direction = sort.split(":")

            # Use GET /notes with query parameters instead of non-existent /activities/query
            response = await client.get(
                "/notes",
                correlation_id,
                params={
                    "parent_object": parent_object,
                    "parent_record_id": record_id.strip(),
                    "limit": limit,
                    "sort_field": sort_field,
                    "sort_direction": sort_direction,
                },
            )

            result = response.get("data", [])
            log_tool_result(tool_name, params, result, start_time, correlation_id)
            return result

        except ToolError:
            raise
        except Exception as e:
            log_tool_error(tool_name, params, e, start_time, correlation_id)
            raise _convert_to_tool_error(e) from e

    # =========================================================================
    # C3: Prefetch Pipeline Configuration
    # =========================================================================

    @mcp.tool()
    async def prefetch_pipeline_config(
        list_id: str | None = None,
    ) -> dict:
        """
        Prefetch and cache pipeline configuration for faster subsequent operations.

        Call this at startup or before batch operations to warm the cache.
        Caches the status mapping (stage name -> status_id) for the pipeline.

        Args:
            list_id: The pipeline/list ID (optional, uses ATTIO_PIPELINE_LIST_ID if not provided)

        Returns:
            Dict with cached configuration info:
                - list_id: The pipeline list ID
                - stages: List of available stage names
                - cached: Whether this was a cache hit or fresh fetch

        Raises:
            ToolError: On validation or API errors
        """
        tool_name = "prefetch_pipeline_config"
        params = {"list_id": list_id}
        start_time = time.perf_counter()
        correlation_id = generate_correlation_id()

        try:
            # Get list ID
            pipeline_list_id = list_id or _get_pipeline_list_id()
            if not validate_list_id(pipeline_list_id):
                raise ToolError("Invalid list_id format")

            client = _get_attio_client()

            # Check if already cached
            was_cached = pipeline_list_id in _list_status_cache

            # Fetch/refresh status mapping
            status_mapping = await _get_list_status_mapping(
                client, pipeline_list_id, correlation_id
            )

            result = {
                "list_id": pipeline_list_id,
                "stages": list(status_mapping.keys()),
                "cached": was_cached,
                "stage_count": len(status_mapping),
            }

            log_tool_result(tool_name, params, result, start_time, correlation_id)
            return result

        except ToolError:
            raise
        except Exception as e:
            log_tool_error(tool_name, params, e, start_time, correlation_id)
            raise _convert_to_tool_error(e) from e

    log.info(
        "attio_tools_registered",
        tools=[
            "find_person",
            "create_person",
            "update_person",
            "update_pipeline_stage",
            "add_activity",
            "create_task",
            "get_pipeline_records",
            "get_record_activities",
            "prefetch_pipeline_config",
        ],
    )
