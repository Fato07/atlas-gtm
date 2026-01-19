"""Unit tests for Attio MCP tools with mocked API responses.

Tests all 8 tools:
- find_person (FR-006)
- create_person (FR-007)
- update_person (FR-008)
- update_pipeline_stage (FR-009)
- add_activity (FR-010)
- create_task (FR-011)
- get_pipeline_records (FR-012)
- get_record_activities (FR-013)

Also tests:
- Error handling (429, 500, 401 responses)
- Retry behavior
- Latency assertions (<10s)
- Stage transition enforcement
"""

from __future__ import annotations

import json
import os
import time
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastmcp import FastMCP
from fastmcp.exceptions import ToolError


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def mock_api_key():
    """Set up mock API key for tests."""
    original = os.environ.get("ATTIO_API_KEY")
    os.environ["ATTIO_API_KEY"] = "test-api-key-12345"
    yield "test-api-key-12345"
    if original:
        os.environ["ATTIO_API_KEY"] = original
    else:
        os.environ.pop("ATTIO_API_KEY", None)


@pytest.fixture
def mock_pipeline_list_id():
    """Set up mock pipeline list ID for tests."""
    original = os.environ.get("ATTIO_PIPELINE_LIST_ID")
    os.environ["ATTIO_PIPELINE_LIST_ID"] = "test-list-12345"
    yield "test-list-12345"
    if original:
        os.environ["ATTIO_PIPELINE_LIST_ID"] = original
    else:
        os.environ.pop("ATTIO_PIPELINE_LIST_ID", None)


@pytest.fixture
def reset_attio_client(mock_api_key, mock_pipeline_list_id):
    """Reset the global Attio client before each test.

    Depends on mock_api_key and mock_pipeline_list_id to ensure
    environment variables are set before module import.
    """
    import atlas_gtm_mcp.attio as attio_module

    # Re-read env vars that were set at module import time
    attio_module.ATTIO_API_KEY = mock_api_key
    attio_module.ATTIO_PIPELINE_LIST_ID = mock_pipeline_list_id
    attio_module._attio_client = None
    # Clear the module-level status cache for test isolation
    attio_module._list_status_cache.clear()
    yield
    attio_module._attio_client = None
    attio_module._list_status_cache.clear()


@pytest.fixture
def mcp_server(reset_attio_client):
    """Create a FastMCP server with Attio tools registered.

    Depends on reset_attio_client which handles all setup including
    env vars and client reset.
    """
    from atlas_gtm_mcp.attio import register_attio_tools

    mcp = FastMCP("test-attio")
    register_attio_tools(mcp)
    return mcp


async def get_tool_fn(mcp_server, tool_name: str):
    """Helper to get a tool function from the MCP server."""
    tools = await mcp_server.get_tools()
    tool = tools.get(tool_name)
    if tool is None:
        raise ValueError(f"Tool '{tool_name}' not found. Available: {list(tools.keys())}")
    return tool.fn


def create_mock_response(
    status_code: int = 200,
    json_data: dict | None = None,
    text: str = "",
) -> httpx.Response:
    """Create a mock httpx.Response object."""
    content = b""
    if json_data is not None:
        content = json.dumps(json_data).encode("utf-8")
    elif text:
        content = text.encode("utf-8")

    response = httpx.Response(
        status_code=status_code,
        content=content,
        request=httpx.Request("GET", "https://api.attio.com/v2/test"),
    )
    return response


# =============================================================================
# Tool Tests - find_person (FR-006)
# =============================================================================


class TestFindPerson:
    """Tests for find_person tool."""

    @pytest.mark.asyncio
    async def test_find_person_success(self, mcp_server):
        """Test finding a person by email returns person data."""
        mock_person = {
            "id": {"record_id": "rec_test123"},
            "values": {
                "email_addresses": [{"email_address": "test@example.com"}],
                "name": [{"full_name": "Test User"}],
            },
        }

        response = create_mock_response(200, {"data": [mock_person]})
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "find_person")
            result = await fn(email="test@example.com")

            assert result is not None
            assert result["id"]["record_id"] == "rec_test123"

    @pytest.mark.asyncio
    async def test_find_person_not_found(self, mcp_server):
        """Test finding a person that doesn't exist returns None."""
        response = create_mock_response(200, {"data": []})
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "find_person")
            result = await fn(email="nonexistent@example.com")

            assert result is None

    @pytest.mark.asyncio
    async def test_find_person_invalid_email(self, mcp_server):
        """Test find_person rejects invalid email format."""
        fn = await get_tool_fn(mcp_server, "find_person")

        with pytest.raises(ToolError, match="Invalid email"):
            await fn(email="not-an-email")


# =============================================================================
# Tool Tests - create_person (FR-007)
# =============================================================================


class TestCreatePerson:
    """Tests for create_person tool."""

    @pytest.mark.asyncio
    async def test_create_person_success(self, mcp_server):
        """Test creating a person with required fields."""
        mock_response = {
            "id": {"record_id": "rec_new123"},
            "values": {
                "email_addresses": [{"email_address": "new@example.com"}],
                "name": [{"full_name": "New User"}],
            },
        }

        response = create_mock_response(200, {"data": mock_response})
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "create_person")
            result = await fn(email="new@example.com", name="New User")

            assert result is not None
            assert result["id"]["record_id"] == "rec_new123"

    @pytest.mark.asyncio
    async def test_create_person_with_optional_fields(self, mcp_server):
        """Test creating a person with all optional fields."""
        mock_response = {
            "id": {"record_id": "rec_full123"},
            "values": {
                "email_addresses": [{"email_address": "full@example.com"}],
                "name": [{"full_name": "Full User"}],
                "job_title": [{"value": "Engineer"}],
            },
        }

        response = create_mock_response(200, {"data": mock_response})
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ) as mock_request:
            fn = await get_tool_fn(mcp_server, "create_person")
            result = await fn(
                email="full@example.com",
                name="Full User",
                company="Acme Inc",
                title="Engineer",
                linkedin_url="https://linkedin.com/in/user",
            )

            assert result is not None
            mock_request.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_person_invalid_email(self, mcp_server):
        """Test create_person rejects invalid email."""
        fn = await get_tool_fn(mcp_server, "create_person")

        with pytest.raises(ToolError, match="Invalid email"):
            await fn(email="invalid", name="Test")

    @pytest.mark.asyncio
    async def test_create_person_empty_name(self, mcp_server):
        """Test create_person rejects empty name."""
        fn = await get_tool_fn(mcp_server, "create_person")

        with pytest.raises(ToolError, match="cannot be empty"):
            await fn(email="test@example.com", name="   ")


# =============================================================================
# Tool Tests - update_person (FR-008)
# =============================================================================


class TestUpdatePerson:
    """Tests for update_person tool."""

    @pytest.mark.asyncio
    async def test_update_person_success(self, mcp_server):
        """Test updating a person record."""
        mock_response = {
            "id": {"record_id": "rec_update123"},
            "values": {"job_title": [{"value": "Senior Engineer"}]},
        }

        response = create_mock_response(200, {"data": mock_response})
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "update_person")
            result = await fn(
                record_id="rec_update123",
                fields={"job_title": [{"value": "Senior Engineer"}]},
            )

            assert result is not None
            assert result["id"]["record_id"] == "rec_update123"

    @pytest.mark.asyncio
    async def test_update_person_invalid_record_id(self, mcp_server):
        """Test update_person rejects invalid record ID."""
        fn = await get_tool_fn(mcp_server, "update_person")

        with pytest.raises(ToolError, match="record_id"):
            await fn(record_id="short", fields={"name": "Test"})

    @pytest.mark.asyncio
    async def test_update_person_empty_fields(self, mcp_server):
        """Test update_person rejects empty fields."""
        fn = await get_tool_fn(mcp_server, "update_person")

        with pytest.raises(ToolError, match="fields"):
            await fn(record_id="rec_valid1234567", fields={})


# =============================================================================
# Tool Tests - update_pipeline_stage (FR-009) with Stage Transition Enforcement
# =============================================================================


class TestUpdatePipelineStage:
    """Tests for update_pipeline_stage tool with stage transition enforcement."""

    @pytest.mark.asyncio
    async def test_update_pipeline_stage_success(self, mcp_server):
        """Test updating pipeline stage with valid transition."""
        # Mock list schema response for status mapping (GET /lists/{id})
        list_schema = {
            "data": {
                "attributes": [
                    {
                        "type": "status",
                        "config": {
                            "statuses": [
                                {"title": "New Reply", "id": {"status_id": "status_new"}},
                                {"title": "Qualifying", "id": {"status_id": "status_qual"}},
                            ]
                        },
                    }
                ]
            }
        }

        # Mock current record state (in new_reply stage)
        # Uses entry_values (not values) and status is a status_id string
        current_record = {
            "data": [
                {
                    "id": {"entry_id": "entry_123"},
                    "entry_values": {
                        "status": [{"status": "status_new"}]
                    },
                }
            ]
        }

        # Mock update response
        update_response = {
            "data": {
                "id": {"entry_id": "entry_123"},
                "entry_values": {"status": [{"status": "status_qual"}]},
            }
        }

        responses = [
            create_mock_response(200, current_record),  # POST /lists/.../entries/query
            create_mock_response(200, list_schema),  # GET /lists/{id}
            create_mock_response(200, update_response),  # PATCH /lists/.../entries/...
        ]
        call_count = [0]

        async def side_effect(*args, **kwargs):
            idx = min(call_count[0], len(responses) - 1)
            call_count[0] += 1
            return responses[idx]

        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, side_effect=side_effect
        ):
            fn = await get_tool_fn(mcp_server, "update_pipeline_stage")
            result = await fn(record_id="rec_test1234567", stage="qualifying")

            assert result is not None
            assert "_transition" in result
            assert result["_transition"]["previous_stage"] == "new_reply"
            assert result["_transition"]["new_stage"] == "qualifying"

    @pytest.mark.asyncio
    async def test_update_pipeline_stage_invalid_transition(self, mcp_server):
        """Test that invalid stage transitions are rejected."""
        # Mock list schema response
        list_schema = {
            "data": {
                "attributes": [
                    {
                        "type": "status",
                        "config": {
                            "statuses": [
                                {"title": "New Reply", "id": {"status_id": "status_new"}},
                                {"title": "Closed Won", "id": {"status_id": "status_won"}},
                            ]
                        },
                    }
                ]
            }
        }

        # Mock current record state (in new_reply stage)
        current_record = {
            "data": [
                {
                    "id": {"entry_id": "entry_123"},
                    "entry_values": {
                        "status": [{"status": "status_new"}]
                    },
                }
            ]
        }

        responses = [
            create_mock_response(200, current_record),  # POST /lists/.../entries/query
            create_mock_response(200, list_schema),  # GET /lists/{id}
        ]
        call_count = [0]

        async def side_effect(*args, **kwargs):
            idx = min(call_count[0], len(responses) - 1)
            call_count[0] += 1
            return responses[idx]

        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, side_effect=side_effect
        ):
            fn = await get_tool_fn(mcp_server, "update_pipeline_stage")

            # new_reply -> closed_won is NOT a valid transition
            with pytest.raises(ToolError, match="Invalid stage transition"):
                await fn(record_id="rec_test1234567", stage="closed_won")

    @pytest.mark.asyncio
    async def test_update_pipeline_stage_force_bypass_validation(self, mcp_server):
        """Test that force=True bypasses transition validation."""
        # Mock list schema response
        list_schema = {
            "data": {
                "attributes": [
                    {
                        "type": "status",
                        "config": {
                            "statuses": [
                                {"title": "New Reply", "id": {"status_id": "status_new"}},
                                {"title": "Closed Won", "id": {"status_id": "status_won"}},
                            ]
                        },
                    }
                ]
            }
        }

        # Mock current record state (in new_reply stage)
        current_record = {
            "data": [
                {
                    "id": {"entry_id": "entry_123"},
                    "entry_values": {
                        "status": [{"status": "status_new"}]
                    },
                }
            ]
        }

        # Mock update response
        update_response = {
            "data": {
                "id": {"entry_id": "entry_123"},
                "entry_values": {"status": [{"status": "status_won"}]},
            }
        }

        responses = [
            create_mock_response(200, current_record),  # POST /lists/.../entries/query
            create_mock_response(200, list_schema),  # GET /lists/{id}
            create_mock_response(200, update_response),  # PATCH /lists/.../entries/...
        ]
        call_count = [0]

        async def side_effect(*args, **kwargs):
            idx = min(call_count[0], len(responses) - 1)
            call_count[0] += 1
            return responses[idx]

        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, side_effect=side_effect
        ):
            fn = await get_tool_fn(mcp_server, "update_pipeline_stage")

            # Force should allow invalid transition
            result = await fn(record_id="rec_test1234567", stage="closed_won", force=True)

            assert result is not None
            assert "_transition" in result
            assert result["_transition"]["forced"] is True

    @pytest.mark.asyncio
    async def test_update_pipeline_stage_terminal_state_blocked(self, mcp_server):
        """Test that transitions from terminal states are blocked."""
        # Mock list schema response
        list_schema = {
            "data": {
                "attributes": [
                    {
                        "type": "status",
                        "config": {
                            "statuses": [
                                {"title": "Closed Won", "id": {"status_id": "status_won"}},
                                {"title": "Qualifying", "id": {"status_id": "status_qual"}},
                            ]
                        },
                    }
                ]
            }
        }

        # Mock current record state (in closed_won - terminal state)
        current_record = {
            "data": [
                {
                    "id": {"entry_id": "entry_123"},
                    "entry_values": {
                        "status": [{"status": "status_won"}]
                    },
                }
            ]
        }

        responses = [
            create_mock_response(200, current_record),  # POST /lists/.../entries/query
            create_mock_response(200, list_schema),  # GET /lists/{id}
        ]
        call_count = [0]

        async def side_effect(*args, **kwargs):
            idx = min(call_count[0], len(responses) - 1)
            call_count[0] += 1
            return responses[idx]

        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, side_effect=side_effect
        ):
            fn = await get_tool_fn(mcp_server, "update_pipeline_stage")

            # closed_won -> qualifying should be blocked (terminal state)
            with pytest.raises(ToolError, match="Invalid stage transition"):
                await fn(record_id="rec_test1234567", stage="qualifying")

    @pytest.mark.asyncio
    async def test_update_pipeline_stage_no_current_stage_allows_any(self, mcp_server):
        """Test that records without a current stage can be moved to any stage."""
        # Mock list schema response
        list_schema = {
            "data": {
                "attributes": [
                    {
                        "type": "status",
                        "config": {
                            "statuses": [
                                {"title": "Qualifying", "id": {"status_id": "status_qual"}},
                            ]
                        },
                    }
                ]
            }
        }

        # Mock current record state (no status set)
        current_record = {
            "data": [
                {
                    "id": {"entry_id": "entry_123"},
                    "entry_values": {},  # No status
                }
            ]
        }

        # Mock update response
        update_response = {
            "data": {
                "id": {"entry_id": "entry_123"},
                "entry_values": {"status": [{"status": "status_qual"}]},
            }
        }

        responses = [
            create_mock_response(200, current_record),  # POST /lists/.../entries/query
            create_mock_response(200, list_schema),  # GET /lists/{id}
            create_mock_response(200, update_response),  # PATCH /lists/.../entries/...
        ]
        call_count = [0]

        async def side_effect(*args, **kwargs):
            idx = min(call_count[0], len(responses) - 1)
            call_count[0] += 1
            return responses[idx]

        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, side_effect=side_effect
        ):
            fn = await get_tool_fn(mcp_server, "update_pipeline_stage")
            result = await fn(record_id="rec_test1234567", stage="qualifying")

            assert result is not None

    @pytest.mark.asyncio
    async def test_update_pipeline_stage_invalid_stage(self, mcp_server):
        """Test that invalid stage names are rejected."""
        fn = await get_tool_fn(mcp_server, "update_pipeline_stage")

        with pytest.raises(ToolError, match="Invalid stage"):
            await fn(record_id="rec_test1234567", stage="invalid_stage")

    @pytest.mark.asyncio
    async def test_update_pipeline_stage_record_not_in_pipeline(self, mcp_server):
        """Test handling record not found in pipeline."""
        # Mock empty record result (record not in pipeline)
        current_record = {"data": []}

        response = create_mock_response(200, current_record)

        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "update_pipeline_stage")

            with pytest.raises(ToolError, match="not found in pipeline"):
                await fn(record_id="rec_notfound1234", stage="qualifying")


# =============================================================================
# Tool Tests - add_activity (FR-010)
# =============================================================================


class TestAddActivity:
    """Tests for add_activity tool."""

    @pytest.mark.asyncio
    async def test_add_activity_success(self, mcp_server):
        """Test adding an activity note to a record."""
        # Tool returns response.get("data") directly, not the full response
        mock_response = {
            "data": {
                "id": {"note_id": "note_123"},
                "title": "Activity logged",
            }
        }

        response = create_mock_response(200, mock_response)
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "add_activity")
            result = await fn(
                record_id="rec_test1234567",
                activity_type="note",
                content="Meeting notes from call",
            )

            assert result is not None
            # Tool returns unwrapped data
            assert result["id"]["note_id"] == "note_123"

    @pytest.mark.asyncio
    async def test_add_activity_invalid_type(self, mcp_server):
        """Test add_activity rejects invalid activity types."""
        fn = await get_tool_fn(mcp_server, "add_activity")

        with pytest.raises(ToolError, match="Invalid activity_type"):
            await fn(
                record_id="rec_test1234567",
                activity_type="sms",  # Invalid type
                content="Content",
            )

    @pytest.mark.asyncio
    async def test_add_activity_all_types(self, mcp_server):
        """Test add_activity accepts all valid activity types."""
        mock_response = {"data": {"id": {"note_id": "note_123"}}}
        response = create_mock_response(200, mock_response)

        for activity_type in ["note", "email", "call", "meeting"]:
            with patch.object(
                httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
            ):
                fn = await get_tool_fn(mcp_server, "add_activity")
                result = await fn(
                    record_id="rec_test1234567",
                    activity_type=activity_type,
                    content=f"Test {activity_type}",
                )
                assert result is not None


# =============================================================================
# Tool Tests - create_task (FR-011)
# =============================================================================


class TestCreateTask:
    """Tests for create_task tool."""

    @pytest.mark.asyncio
    async def test_create_task_success(self, mcp_server):
        """Test creating a task for a record."""
        # Tool returns response.get("data") directly
        mock_response = {
            "data": {
                "id": {"task_id": "task_123"},
                "content": "Follow up call",
            }
        }

        response = create_mock_response(200, mock_response)
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "create_task")
            result = await fn(
                record_id="rec_test1234567",
                content="Follow up call",
            )

            assert result is not None
            # Tool returns unwrapped data
            assert result["id"]["task_id"] == "task_123"

    @pytest.mark.asyncio
    async def test_create_task_with_deadline(self, mcp_server):
        """Test creating a task with a deadline."""
        mock_response = {
            "data": {
                "id": {"task_id": "task_124"},
                "content": "Follow up",
                "deadline_at": "2024-12-31T00:00:00Z",
            }
        }

        response = create_mock_response(200, mock_response)
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "create_task")
            result = await fn(
                record_id="rec_test1234567",
                content="Follow up",
                deadline_at="2024-12-31",
            )

            assert result is not None

    @pytest.mark.asyncio
    async def test_create_task_invalid_deadline_format(self, mcp_server):
        """Test create_task rejects invalid deadline format."""
        fn = await get_tool_fn(mcp_server, "create_task")

        with pytest.raises(ToolError, match="ISO format"):
            await fn(
                record_id="rec_test1234567",
                content="Follow up",
                deadline_at="31/12/2024",  # Wrong format
            )


# =============================================================================
# Tool Tests - get_pipeline_records (FR-012)
# =============================================================================


class TestGetPipelineRecords:
    """Tests for get_pipeline_records tool."""

    @pytest.mark.asyncio
    async def test_get_pipeline_records_success(self, mcp_server):
        """Test retrieving pipeline records with pagination."""
        mock_response = {
            "data": [
                {
                    "id": {"entry_id": "entry_1"},
                    "entry_values": {"status": [{"status": "status_qual"}]},
                },
                {
                    "id": {"entry_id": "entry_2"},
                    "entry_values": {"status": [{"status": "status_new"}]},
                },
            ]
        }

        response = create_mock_response(200, mock_response)
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "get_pipeline_records")
            result = await fn()

            assert result is not None
            # Now returns dict with data and pagination
            assert "data" in result
            assert "pagination" in result
            assert len(result["data"]) == 2
            assert result["pagination"]["offset"] == 0
            assert result["pagination"]["count"] == 2

    @pytest.mark.asyncio
    async def test_get_pipeline_records_with_stage_filter(self, mcp_server):
        """Test filtering pipeline records by stage."""
        mock_response = {
            "data": [
                {
                    "id": {"entry_id": "entry_1"},
                    "entry_values": {"status": [{"status": "status_qual"}]},
                },
            ]
        }

        response = create_mock_response(200, mock_response)
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "get_pipeline_records")
            result = await fn(stage="qualifying")

            assert result is not None
            # Now returns dict with data and pagination
            assert len(result["data"]) == 1

    @pytest.mark.asyncio
    async def test_get_pipeline_records_invalid_stage(self, mcp_server):
        """Test get_pipeline_records rejects invalid stage filter."""
        fn = await get_tool_fn(mcp_server, "get_pipeline_records")

        with pytest.raises(ToolError, match="Invalid stage"):
            await fn(stage="invalid_stage")

    @pytest.mark.asyncio
    async def test_get_pipeline_records_invalid_limit(self, mcp_server):
        """Test get_pipeline_records rejects invalid limit."""
        fn = await get_tool_fn(mcp_server, "get_pipeline_records")

        with pytest.raises(ToolError, match="limit"):
            await fn(limit=0)


# =============================================================================
# Tool Tests - get_record_activities (FR-013)
# =============================================================================


class TestGetRecordActivities:
    """Tests for get_record_activities tool."""

    @pytest.mark.asyncio
    async def test_get_record_activities_success(self, mcp_server):
        """Test retrieving activities for a record."""
        # Tool returns response.get("data", []) directly as a list
        mock_response = {
            "data": [
                {
                    "id": {"note_id": "note_1"},
                    "title": "Call notes",
                    "created_at": "2024-01-15T10:00:00Z",
                },
                {
                    "id": {"note_id": "note_2"},
                    "title": "Follow up",
                    "created_at": "2024-01-16T10:00:00Z",
                },
            ]
        }

        response = create_mock_response(200, mock_response)
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "get_record_activities")
            result = await fn(record_id="rec_test1234567")

            assert result is not None
            # Tool returns the list directly
            assert len(result) == 2

    @pytest.mark.asyncio
    async def test_get_record_activities_empty(self, mcp_server):
        """Test retrieving activities when none exist."""
        mock_response = {"data": []}

        response = create_mock_response(200, mock_response)
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "get_record_activities")
            result = await fn(record_id="rec_test1234567")

            assert result is not None
            # Tool returns the list directly
            assert len(result) == 0

    @pytest.mark.asyncio
    async def test_get_record_activities_invalid_record_id(self, mcp_server):
        """Test get_record_activities rejects invalid record ID."""
        fn = await get_tool_fn(mcp_server, "get_record_activities")

        with pytest.raises(ToolError, match="record_id"):
            await fn(record_id="short")


# =============================================================================
# Error Injection Tests (FR-017)
# =============================================================================


class TestErrorInjection:
    """Tests for error handling and HTTP error codes."""

    @pytest.mark.asyncio
    async def test_401_authentication_error(self, mcp_server):
        """Test 401 error is properly handled."""
        response = create_mock_response(401, {"error": "Unauthorized"})
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "find_person")

            with pytest.raises(ToolError, match="[Aa]uthentication"):
                await fn(email="test@example.com")

    @pytest.mark.asyncio
    async def test_403_permission_denied(self, mcp_server):
        """Test 403 error is properly handled."""
        response = create_mock_response(403, {"error": "Forbidden"})
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "find_person")

            with pytest.raises(ToolError, match="[Pp]ermission|[Ff]orbidden"):
                await fn(email="test@example.com")

    @pytest.mark.asyncio
    async def test_404_not_found(self, mcp_server):
        """Test 404 error is properly handled."""
        response = create_mock_response(404, {"error": "Not found"})
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "update_person")

            with pytest.raises(ToolError, match="[Nn]ot [Ff]ound"):
                await fn(record_id="rec_nonexistent12", fields={"name": "Test"})

    @pytest.mark.asyncio
    async def test_429_rate_limited_with_retry(self, mcp_server):
        """Test 429 error triggers retry behavior."""
        # First call returns 429, second call succeeds
        rate_limit_response = create_mock_response(429, {"error": "Rate limited"})
        success_response = create_mock_response(200, {"data": []})

        call_count = [0]

        async def side_effect(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return rate_limit_response
            return success_response

        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, side_effect=side_effect
        ):
            fn = await get_tool_fn(mcp_server, "find_person")
            result = await fn(email="test@example.com")

            # Should have retried and succeeded
            assert result is None  # No person found, but call succeeded
            assert call_count[0] >= 2

    @pytest.mark.asyncio
    async def test_500_server_error_with_retry(self, mcp_server):
        """Test 500 error triggers retry behavior."""
        error_response = create_mock_response(500, {"error": "Server error"})
        success_response = create_mock_response(200, {"data": []})

        call_count = [0]

        async def side_effect(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return error_response
            return success_response

        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, side_effect=side_effect
        ):
            fn = await get_tool_fn(mcp_server, "find_person")
            result = await fn(email="test@example.com")

            # Should have retried and succeeded
            assert result is None
            assert call_count[0] >= 2

    @pytest.mark.asyncio
    async def test_503_service_unavailable(self, mcp_server):
        """Test 503 error is properly handled after retries exhaust."""
        response = create_mock_response(503, {"error": "Service unavailable"})
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "find_person")

            with pytest.raises(ToolError, match="[Ss]ervice|[Uu]navailable|503"):
                await fn(email="test@example.com")

    @pytest.mark.asyncio
    async def test_422_validation_error(self, mcp_server):
        """Test 422 validation error is properly handled."""
        response = create_mock_response(
            422, {"error": {"message": "Validation failed"}}
        )
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "create_person")

            with pytest.raises(ToolError, match="[Vv]alidation"):
                await fn(email="valid@example.com", name="Test User")


# =============================================================================
# Retry Behavior Tests
# =============================================================================


class TestRetryBehavior:
    """Tests for retry logic on transient errors."""

    @pytest.mark.asyncio
    async def test_retry_on_network_error(self, mcp_server):
        """Test that network errors trigger retries."""
        success_response = create_mock_response(200, {"data": []})
        call_count = [0]

        async def side_effect(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                raise httpx.ConnectError("Connection failed")
            return success_response

        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, side_effect=side_effect
        ):
            fn = await get_tool_fn(mcp_server, "find_person")
            result = await fn(email="test@example.com")

            assert result is None  # Call succeeded after retry
            assert call_count[0] >= 2

    @pytest.mark.asyncio
    async def test_retry_on_timeout(self, mcp_server):
        """Test that timeouts trigger retries."""
        success_response = create_mock_response(200, {"data": []})
        call_count = [0]

        async def side_effect(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                raise httpx.ReadTimeout("Read timed out")
            return success_response

        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, side_effect=side_effect
        ):
            fn = await get_tool_fn(mcp_server, "find_person")
            result = await fn(email="test@example.com")

            assert result is None
            assert call_count[0] >= 2

    @pytest.mark.asyncio
    async def test_max_retries_exceeded(self, mcp_server):
        """Test that errors after max retries raise ToolError."""
        error_response = create_mock_response(500, {"error": "Server error"})

        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=error_response
        ):
            fn = await get_tool_fn(mcp_server, "find_person")

            with pytest.raises(ToolError):
                await fn(email="test@example.com")

    @pytest.mark.asyncio
    async def test_no_retry_on_authentication_error(self, mcp_server):
        """Test that 401 errors are not retried."""
        error_response = create_mock_response(401, {"error": "Unauthorized"})
        call_count = [0]

        async def side_effect(*args, **kwargs):
            call_count[0] += 1
            return error_response

        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, side_effect=side_effect
        ):
            fn = await get_tool_fn(mcp_server, "find_person")

            with pytest.raises(ToolError, match="[Aa]uthentication"):
                await fn(email="test@example.com")

            # Should not retry 401 errors
            assert call_count[0] == 1


# =============================================================================
# Latency Assertion Tests
# =============================================================================


class TestLatencyAssertions:
    """Tests for operation latency requirements (<10s)."""

    @pytest.mark.asyncio
    async def test_tool_completes_within_10_seconds(self, mcp_server):
        """Test that tools complete within acceptable latency."""
        mock_response = create_mock_response(200, {"data": []})

        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=mock_response
        ):
            fn = await get_tool_fn(mcp_server, "find_person")

            start_time = time.time()
            await fn(email="test@example.com")
            elapsed = time.time() - start_time

            # Should complete well under 10 seconds (mocked)
            assert elapsed < 10, f"Tool took {elapsed}s, exceeds 10s limit"


# =============================================================================
# Error Sanitization Tests (FR-003)
# =============================================================================


class TestErrorSanitization:
    """Tests for error message sanitization."""

    def test_api_key_redacted_in_errors(self):
        """Test that API keys are not exposed in error messages."""
        from atlas_gtm_mcp.attio.logging import _sanitize_params

        params = {"api_key": "secret-key-12345", "email": "test@example.com"}
        sanitized = _sanitize_params(params)

        assert "secret-key-12345" not in str(sanitized)
        assert "test@example.com" not in str(sanitized)

    def test_long_strings_truncated(self):
        """Test that long strings are truncated in sanitization."""
        from atlas_gtm_mcp.attio.logging import _sanitize_params

        long_value = "x" * 600
        params = {"content": long_value}
        sanitized = _sanitize_params(params)

        # Long strings should be truncated at 500 chars
        assert len(sanitized["content"]) < len(long_value)
        assert "truncated" in sanitized["content"]


# =============================================================================
# Logging Tests
# =============================================================================


class TestLogging:
    """Tests for structured logging functionality."""

    def test_correlation_id_generation(self):
        """Test that correlation IDs are generated correctly."""
        from atlas_gtm_mcp.attio.logging import generate_correlation_id

        id1 = generate_correlation_id()
        id2 = generate_correlation_id()

        assert isinstance(id1, str)
        assert len(id1) == 8
        assert id1 != id2

    def test_sensitive_data_sanitization(self):
        """Test sanitization of sensitive data in logs."""
        from atlas_gtm_mcp.attio.logging import _sanitize_params

        params = {
            "email": "test@example.com",
            "api_key": "secret123",
            "name": "John Doe",
        }

        sanitized = _sanitize_params(params)

        # Email should be partially masked
        assert "test@example.com" not in str(sanitized)
        # API key should be masked
        assert "secret123" not in str(sanitized)

    def test_result_counting(self):
        """Test result counting in response data."""
        from atlas_gtm_mcp.attio.logging import _count_results

        # Test with list data
        assert _count_results([1, 2, 3]) == 3

        # Test with single item dict
        assert _count_results({"id": "123"}) == 1

        # Test with None
        assert _count_results(None) == 0


# =============================================================================
# Phase 2 & 3 Feature Tests
# =============================================================================


class TestAddActivityMetadata:
    """Tests for add_activity metadata parameter (B1)."""

    @pytest.mark.asyncio
    async def test_add_activity_with_metadata(self, mcp_server):
        """Test adding an activity with metadata."""
        mock_response = {
            "data": {
                "id": {"note_id": "note_123"},
                "title": "Email: Re: Meeting",
            }
        }

        response = create_mock_response(200, mock_response)
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ) as mock_request:
            fn = await get_tool_fn(mcp_server, "add_activity")
            result = await fn(
                record_id="rec_test1234567",
                activity_type="email",
                content="Email content here",
                metadata={"subject": "Re: Meeting", "sender": "john@example.com"},
            )

            assert result is not None
            assert result["id"]["note_id"] == "note_123"
            # Verify metadata was included in the content
            call_args = mock_request.call_args
            json_data = call_args.kwargs.get("json") or call_args[1].get("json")
            assert "Metadata:" in json_data["data"]["content"]

    @pytest.mark.asyncio
    async def test_add_activity_metadata_in_title(self, mcp_server):
        """Test that subject metadata is used in title."""
        mock_response = {"data": {"id": {"note_id": "note_123"}}}

        response = create_mock_response(200, mock_response)
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ) as mock_request:
            fn = await get_tool_fn(mcp_server, "add_activity")
            await fn(
                record_id="rec_test1234567",
                activity_type="email",
                content="Content",
                metadata={"subject": "Important Meeting"},
            )

            call_args = mock_request.call_args
            json_data = call_args.kwargs.get("json") or call_args[1].get("json")
            assert "Important Meeting" in json_data["data"]["title"]

    @pytest.mark.asyncio
    async def test_add_activity_invalid_metadata(self, mcp_server):
        """Test that invalid metadata type raises error."""
        fn = await get_tool_fn(mcp_server, "add_activity")

        with pytest.raises(ToolError, match="metadata must be a dictionary"):
            await fn(
                record_id="rec_test1234567",
                activity_type="note",
                content="Content",
                metadata="invalid",  # Should be dict
            )


class TestGetRecordActivitiesSort:
    """Tests for get_record_activities sort parameter (B3)."""

    @pytest.mark.asyncio
    async def test_get_activities_default_sort(self, mcp_server):
        """Test default sort is created_at:desc."""
        mock_response = {"data": [{"id": {"note_id": "note_1"}}]}

        response = create_mock_response(200, mock_response)
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ) as mock_request:
            fn = await get_tool_fn(mcp_server, "get_record_activities")
            await fn(record_id="rec_test1234567")

            call_args = mock_request.call_args
            params = call_args.kwargs.get("params") or call_args[1].get("params")
            assert params["sort_field"] == "created_at"
            assert params["sort_direction"] == "desc"

    @pytest.mark.asyncio
    async def test_get_activities_ascending_sort(self, mcp_server):
        """Test ascending sort order."""
        mock_response = {"data": [{"id": {"note_id": "note_1"}}]}

        response = create_mock_response(200, mock_response)
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ) as mock_request:
            fn = await get_tool_fn(mcp_server, "get_record_activities")
            await fn(record_id="rec_test1234567", sort="created_at:asc")

            call_args = mock_request.call_args
            params = call_args.kwargs.get("params") or call_args[1].get("params")
            assert params["sort_direction"] == "asc"

    @pytest.mark.asyncio
    async def test_get_activities_invalid_sort(self, mcp_server):
        """Test invalid sort raises error."""
        fn = await get_tool_fn(mcp_server, "get_record_activities")

        with pytest.raises(ToolError, match="Invalid sort"):
            await fn(record_id="rec_test1234567", sort="invalid:sort")


class TestGetPipelineRecordsPagination:
    """Tests for get_pipeline_records pagination (C1)."""

    @pytest.mark.asyncio
    async def test_pagination_with_offset(self, mcp_server):
        """Test pagination with offset parameter."""
        mock_response = {
            "data": [{"id": {"entry_id": "entry_3"}}]
        }

        response = create_mock_response(200, mock_response)
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ) as mock_request:
            fn = await get_tool_fn(mcp_server, "get_pipeline_records")
            result = await fn(limit=10, offset=20)

            assert result["pagination"]["offset"] == 20
            assert result["pagination"]["limit"] == 10
            # Verify offset was sent to API
            call_args = mock_request.call_args
            json_data = call_args.kwargs.get("json") or call_args[1].get("json")
            assert json_data["offset"] == 20

    @pytest.mark.asyncio
    async def test_pagination_has_more_indicator(self, mcp_server):
        """Test has_more is true when page is full."""
        # Return full page (limit=10)
        mock_response = {
            "data": [{"id": {"entry_id": f"entry_{i}"}} for i in range(10)]
        }

        response = create_mock_response(200, mock_response)
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "get_pipeline_records")
            result = await fn(limit=10)

            assert result["pagination"]["has_more"] is True

    @pytest.mark.asyncio
    async def test_pagination_no_more_when_partial(self, mcp_server):
        """Test has_more is false when page is not full."""
        # Return partial page (5 records with limit=10)
        mock_response = {
            "data": [{"id": {"entry_id": f"entry_{i}"}} for i in range(5)]
        }

        response = create_mock_response(200, mock_response)
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "get_pipeline_records")
            result = await fn(limit=10)

            assert result["pagination"]["has_more"] is False

    @pytest.mark.asyncio
    async def test_pagination_invalid_offset(self, mcp_server):
        """Test invalid offset raises error."""
        fn = await get_tool_fn(mcp_server, "get_pipeline_records")

        with pytest.raises(ToolError, match="offset must be a non-negative integer"):
            await fn(offset=-1)


class TestRetryAfterHeader:
    """Tests for Retry-After header support (C2)."""

    @pytest.mark.asyncio
    async def test_retry_after_header_extracted(self, mcp_server):
        """Test that Retry-After header is extracted from 429 response."""
        from atlas_gtm_mcp.attio import AttioRetriableError

        # Create a 429 response with Retry-After header
        error_response = httpx.Response(
            status_code=429,
            content=json.dumps({"error": "Rate limited"}).encode("utf-8"),
            headers={"Retry-After": "5"},
            request=httpx.Request("GET", "https://api.attio.com/v2/test"),
        )

        call_count = [0]

        async def side_effect(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] < 3:
                return error_response
            return create_mock_response(200, {"data": []})

        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, side_effect=side_effect
        ):
            fn = await get_tool_fn(mcp_server, "find_person")
            result = await fn(email="test@example.com")
            # Should eventually succeed after retries
            assert result is None  # Empty search result

    def test_retry_after_in_exception(self):
        """Test that AttioRetriableError stores retry_after value."""
        from atlas_gtm_mcp.attio import AttioRetriableError, AttioErrorType

        error = AttioRetriableError(
            "Rate limited",
            AttioErrorType.RATE_LIMITED,
            429,
            retry_after=5.0,
        )
        assert error.retry_after == 5.0

    def test_custom_wait_strategy_uses_retry_after(self):
        """Test that custom wait uses Retry-After when available."""
        from atlas_gtm_mcp.attio import _wait_with_retry_after, AttioRetriableError, AttioErrorType
        from unittest.mock import Mock

        # Create mock retry state
        retry_state = Mock()
        error = AttioRetriableError("Rate limited", AttioErrorType.RATE_LIMITED, 429, retry_after=3.0)
        retry_state.outcome = Mock()
        retry_state.outcome.exception.return_value = error

        wait_time = _wait_with_retry_after(retry_state)
        assert wait_time == 3.0


class TestPrefetchPipelineConfig:
    """Tests for prefetch_pipeline_config tool (C3)."""

    @pytest.mark.asyncio
    async def test_prefetch_success(self, mcp_server):
        """Test prefetching pipeline configuration."""
        mock_list_response = {
            "data": {
                "id": {"list_id": "test-list-12345"},
                "attributes": [
                    {
                        "type": "status",
                        "config": {
                            "statuses": [
                                {"title": "New Reply", "id": {"status_id": "status_new"}},
                                {"title": "Qualifying", "id": {"status_id": "status_qual"}},
                            ]
                        },
                    }
                ],
            }
        }

        response = create_mock_response(200, mock_list_response)
        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "prefetch_pipeline_config")
            result = await fn()

            assert result is not None
            assert "stages" in result
            assert "list_id" in result
            assert result["stage_count"] >= 2

    @pytest.mark.asyncio
    async def test_prefetch_returns_cached_status(self, mcp_server):
        """Test that prefetch indicates cache status."""
        mock_list_response = {
            "data": {
                "id": {"list_id": "test-list-12345"},
                "attributes": [
                    {
                        "type": "status",
                        "config": {
                            "statuses": [
                                {"title": "New Reply", "id": {"status_id": "status_new"}},
                            ]
                        },
                    }
                ],
            }
        }

        response = create_mock_response(200, mock_list_response)

        # Clear the cache first
        import atlas_gtm_mcp.attio as attio_module
        attio_module._list_status_cache.clear()

        with patch.object(
            httpx.AsyncClient, "request", new_callable=AsyncMock, return_value=response
        ):
            fn = await get_tool_fn(mcp_server, "prefetch_pipeline_config")

            # First call should be fresh
            result1 = await fn()
            assert result1["cached"] is False

            # Second call should be cached
            result2 = await fn()
            assert result2["cached"] is True
