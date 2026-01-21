"""Pytest fixtures for HeyReach MCP tool tests.

Provides:
- Mock HeyReach API server with httpx-mock
- Sample data fixtures for campaigns, leads, messages, accounts
- Client fixtures with test configuration
- Environment variable management
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock, patch

import pytest

if TYPE_CHECKING:
    from collections.abc import Generator


# =============================================================================
# Environment Fixtures
# =============================================================================


@pytest.fixture
def env_api_key() -> Generator[str, None, None]:
    """Provide a test API key via environment variable."""
    test_key = "test_heyreach_api_key_12345"
    with patch.dict(os.environ, {"HEYREACH_API_KEY": test_key}):
        yield test_key


@pytest.fixture
def env_vars(env_api_key: str) -> Generator[dict[str, str], None, None]:
    """Provide all required environment variables."""
    yield {"HEYREACH_API_KEY": env_api_key}


# =============================================================================
# Sample Data Fixtures
# =============================================================================


@pytest.fixture
def sample_campaign() -> dict[str, Any]:
    """Sample campaign record from HeyReach API."""
    return {
        "id": "camp_hr_12345678901234567890",
        "name": "LinkedIn Q1 Outreach",
        "status": "ACTIVE",
        "created_at": "2024-01-15T10:30:00.000Z",
        "linkedin_account_ids": ["acc_linkedin_12345"],
        "lead_count": 250,
    }


@pytest.fixture
def sample_campaign_list() -> list[dict[str, Any]]:
    """Sample list of campaigns response."""
    return [
        {
            "id": "camp_hr_12345678901234567890",
            "name": "LinkedIn Q1 Outreach",
            "status": "ACTIVE",
            "lead_count": 250,
        },
        {
            "id": "camp_hr_22345678901234567891",
            "name": "ABM Campaign",
            "status": "PAUSED",
            "lead_count": 100,
        },
    ]


@pytest.fixture
def sample_lead() -> dict[str, Any]:
    """Sample lead record from HeyReach API."""
    return {
        "id": "lead_hr_12345678901234567890",
        "linkedin_url": "https://linkedin.com/in/johndoe",
        "first_name": "John",
        "last_name": "Doe",
        "company": "Example Corp",
        "title": "VP of Engineering",
        "email": "john.doe@example.com",
        "tags": ["decision-maker", "tech"],
        "status": "CONNECTED",
    }


@pytest.fixture
def sample_lead_list() -> list[dict[str, Any]]:
    """Sample list of leads response."""
    return [
        {
            "id": "lead_hr_12345678901234567890",
            "linkedin_url": "https://linkedin.com/in/johndoe",
            "first_name": "John",
            "last_name": "Doe",
            "status": "CONNECTED",
        },
        {
            "id": "lead_hr_22345678901234567891",
            "linkedin_url": "https://linkedin.com/in/janesmith",
            "first_name": "Jane",
            "last_name": "Smith",
            "status": "REPLIED",
        },
    ]


@pytest.fixture
def sample_conversation() -> dict[str, Any]:
    """Sample conversation from HeyReach API."""
    return {
        "id": "conv_hr_12345678901234567890",
        "lead_id": "lead_hr_12345678901234567890",
        "lead_name": "John Doe",
        "last_message": "Thanks for connecting! Would love to chat.",
        "last_message_at": "2024-01-20T14:30:00.000Z",
        "unread": True,
    }


@pytest.fixture
def sample_conversation_with_messages() -> dict[str, Any]:
    """Sample conversation with messages from HeyReach API."""
    return {
        "id": "conv_hr_12345678901234567890",
        "lead_id": "lead_hr_12345678901234567890",
        "lead_name": "John Doe",
        "messages": [
            {
                "id": "msg_hr_001",
                "sender": "me",
                "content": "Hi John, I noticed your work at Example Corp...",
                "sent_at": "2024-01-16T10:00:00.000Z",
                "read": True,
            },
            {
                "id": "msg_hr_002",
                "sender": "John Doe",
                "content": "Thanks for reaching out! I'd be happy to connect.",
                "sent_at": "2024-01-16T14:30:00.000Z",
                "read": True,
            },
            {
                "id": "msg_hr_003",
                "sender": "me",
                "content": "Great! Would you have time for a quick call?",
                "sent_at": "2024-01-17T09:00:00.000Z",
                "read": True,
            },
        ],
    }


@pytest.fixture
def sample_linkedin_account() -> dict[str, Any]:
    """Sample LinkedIn account from HeyReach API."""
    return {
        "id": "acc_linkedin_12345",
        "name": "Sales Account",
        "linkedin_url": "https://linkedin.com/in/salesrep",
        "status": "CONNECTED",
        "daily_connection_limit": 25,
        "daily_message_limit": 100,
        "connections_sent_today": 15,
        "messages_sent_today": 45,
    }


@pytest.fixture
def sample_linkedin_account_list() -> list[dict[str, Any]]:
    """Sample list of LinkedIn accounts response."""
    return [
        {
            "id": "acc_linkedin_12345",
            "name": "Sales Account",
            "linkedin_url": "https://linkedin.com/in/salesrep",
            "status": "CONNECTED",
        },
        {
            "id": "acc_linkedin_67890",
            "name": "Marketing Account",
            "linkedin_url": "https://linkedin.com/in/marketing",
            "status": "WARMING_UP",
        },
    ]


@pytest.fixture
def sample_lead_list_data() -> dict[str, Any]:
    """Sample lead list from HeyReach API."""
    return {
        "id": "list_hr_12345678901234567890",
        "name": "Tech Decision Makers",
        "lead_count": 150,
        "created_at": "2024-01-10T08:00:00.000Z",
    }


@pytest.fixture
def sample_stats() -> dict[str, Any]:
    """Sample stats from HeyReach API."""
    return {
        "connections_sent": 150,
        "connections_accepted": 85,
        "messages_sent": 200,
        "messages_replied": 35,
        "profile_views": 320,
    }


@pytest.fixture
def sample_webhook() -> dict[str, Any]:
    """Sample webhook from HeyReach API."""
    return {
        "id": "webhook_hr_12345678901234567890",
        "url": "https://example.com/webhook",
        "events": ["lead.replied", "lead.connected"],
        "active": True,
        "created_at": "2024-01-01T00:00:00.000Z",
    }


# =============================================================================
# Mock Response Builders
# =============================================================================


def create_mock_response(status_code: int, json_data: dict) -> MagicMock:
    """Create a mock httpx response with proper sync json() method."""
    mock_response = MagicMock()
    mock_response.status_code = status_code
    mock_response.json.return_value = json_data
    mock_response.headers = {}
    mock_response.text = str(json_data)
    mock_response.request = MagicMock()
    mock_response.request.method = "GET"
    mock_response.request.url = MagicMock()
    mock_response.request.url.path = "/test"
    return mock_response


def make_heyreach_response(data: Any) -> dict[str, Any]:
    """Build a standard HeyReach API response wrapper."""
    return data


def make_heyreach_list_response(items: list[Any]) -> list[Any]:
    """Build a standard HeyReach API list response."""
    return items


def make_heyreach_error_response(
    message: str,
    status_code: int = 400,
    error_code: str | None = None
) -> dict[str, Any]:
    """Build a HeyReach API error response."""
    error: dict[str, Any] = {"message": message}
    if error_code:
        error["code"] = error_code
    return {"error": error}


# =============================================================================
# Client Fixture with Cache Cleanup
# =============================================================================


@pytest.fixture
def reset_heyreach_client(env_api_key) -> Generator[None, None, None]:
    """Reset the global HeyReach client between tests."""
    import atlas_gtm_mcp.heyreach.client as client_module

    # Save and clear existing client
    old_client = client_module._heyreach_client
    old_api_key = client_module.HEYREACH_API_KEY
    client_module._heyreach_client = None
    # Patch the module-level constant with the test API key
    client_module.HEYREACH_API_KEY = env_api_key

    yield

    # Restore original state
    client_module._heyreach_client = old_client
    client_module.HEYREACH_API_KEY = old_api_key
