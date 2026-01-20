"""Integration tests for Attio MCP tools.

These tests require:
- ATTIO_API_KEY environment variable to be set
- ATTIO_PIPELINE_LIST_ID environment variable to be set (for pipeline operations)
- A valid Attio workspace with the configured pipeline

Run with: pytest -m integration tests/integration/test_attio_integration.py
"""

import os
import uuid

import pytest
from fastmcp.exceptions import ToolError

# Check for Attio configuration
ATTIO_API_KEY = os.getenv("ATTIO_API_KEY")
ATTIO_PIPELINE_LIST_ID = os.getenv("ATTIO_PIPELINE_LIST_ID")


def is_attio_configured() -> bool:
    """Check if Attio API is configured."""
    return bool(ATTIO_API_KEY and ATTIO_PIPELINE_LIST_ID)


requires_attio = pytest.mark.skipif(
    not is_attio_configured(),
    reason="ATTIO_API_KEY and ATTIO_PIPELINE_LIST_ID not configured",
)


@pytest.fixture
def test_email() -> str:
    """Generate a unique test email address."""
    unique_id = str(uuid.uuid4())[:8]
    return f"test-{unique_id}@atlas-gtm-test.example"


class TestInputValidation:
    """Tests for input validation (FR-019, FR-020, FR-021).

    These tests don't require Attio API - they test validation before API calls.
    """

    def test_email_validation_valid(self):
        """Test valid email formats pass validation."""
        from atlas_gtm_mcp.attio.models import validate_email

        valid_emails = [
            "user@example.com",
            "user.name@example.com",
            "user+tag@example.com",
            "user@subdomain.example.com",
        ]
        for email in valid_emails:
            assert validate_email(email) is True

    def test_email_validation_invalid(self):
        """Test invalid email formats fail validation."""
        from atlas_gtm_mcp.attio.models import validate_email

        invalid_emails = [
            "invalid",
            "invalid@",
            "@example.com",
            "",
        ]
        for email in invalid_emails:
            assert validate_email(email) is False

    def test_pipeline_stage_validation_valid(self):
        """Test valid pipeline stages pass validation."""
        from atlas_gtm_mcp.attio.models import PipelineStage

        valid_stages = [
            "new_reply",
            "qualifying",
            "meeting_scheduled",
            "meeting_held",
            "proposal",
            "closed_won",
            "closed_lost",
        ]
        for stage in valid_stages:
            assert PipelineStage.validate(stage) is True

    def test_pipeline_stage_validation_invalid(self):
        """Test invalid pipeline stages fail validation (FR-015)."""
        from atlas_gtm_mcp.attio.models import PipelineStage

        invalid_stages = [
            "invalid_stage",
            "QUALIFYING",  # Case sensitive
            "",
        ]
        for stage in invalid_stages:
            assert PipelineStage.validate(stage) is False

    def test_activity_type_validation_valid(self):
        """Test valid activity types pass validation (FR-021)."""
        from atlas_gtm_mcp.attio.models import ActivityType

        valid_types = ["note", "email", "call", "meeting"]
        for activity_type in valid_types:
            assert ActivityType.validate(activity_type) is True

    def test_activity_type_validation_invalid(self):
        """Test invalid activity types fail validation (FR-021)."""
        from atlas_gtm_mcp.attio.models import ActivityType

        invalid_types = ["sms", "chat", "NOTE", ""]
        for activity_type in invalid_types:
            assert ActivityType.validate(activity_type) is False

    def test_non_empty_string_validation(self):
        """Test non-empty string validation (FR-020)."""
        from atlas_gtm_mcp.attio.models import validate_non_empty_string

        # Valid
        assert validate_non_empty_string("hello", "field") == "hello"
        assert validate_non_empty_string("  hello  ", "field") == "hello"

        # Invalid
        with pytest.raises(ValueError, match="cannot be empty"):
            validate_non_empty_string("", "field")

        with pytest.raises(ValueError, match="cannot be empty"):
            validate_non_empty_string("   ", "field")


class TestPipelineStageValues:
    """Tests for pipeline stage values per spec (FR-014)."""

    def test_all_seven_stages_defined(self):
        """Test that all 7 required pipeline stages are defined."""
        from atlas_gtm_mcp.attio.models import PipelineStage

        expected_stages = {
            "new_reply",
            "qualifying",
            "meeting_scheduled",
            "meeting_held",
            "proposal",
            "closed_won",
            "closed_lost",
        }
        actual_stages = set(PipelineStage.values())
        assert actual_stages == expected_stages

    def test_values_method_returns_list(self):
        """Test values() method returns list in correct order."""
        from atlas_gtm_mcp.attio.models import PipelineStage

        values = PipelineStage.values()
        assert isinstance(values, list)
        assert len(values) == 7


class TestErrorClassification:
    """Tests for error classification (FR-017)."""

    def test_retriable_errors(self):
        """Test retriable error types are identified correctly."""
        from atlas_gtm_mcp.attio.models import AttioErrorType

        retriable = [
            AttioErrorType.RATE_LIMITED,
            AttioErrorType.NETWORK_ERROR,
            AttioErrorType.TIMEOUT,
            AttioErrorType.SERVICE_UNAVAILABLE,
        ]
        for error_type in retriable:
            assert AttioErrorType.is_retriable(error_type) is True

    def test_non_retriable_errors(self):
        """Test non-retriable error types are identified correctly."""
        from atlas_gtm_mcp.attio.models import AttioErrorType

        non_retriable = [
            AttioErrorType.AUTHENTICATION,
            AttioErrorType.VALIDATION,
            AttioErrorType.NOT_FOUND,
            AttioErrorType.PERMISSION_DENIED,
        ]
        for error_type in non_retriable:
            assert AttioErrorType.is_retriable(error_type) is False

    def test_http_status_classification(self):
        """Test HTTP status codes are classified correctly."""
        from atlas_gtm_mcp.attio.models import classify_http_error, AttioErrorType

        assert classify_http_error(401) == AttioErrorType.AUTHENTICATION
        assert classify_http_error(403) == AttioErrorType.PERMISSION_DENIED
        assert classify_http_error(404) == AttioErrorType.NOT_FOUND
        assert classify_http_error(429) == AttioErrorType.RATE_LIMITED
        assert classify_http_error(500) == AttioErrorType.SERVICE_UNAVAILABLE
        assert classify_http_error(503) == AttioErrorType.SERVICE_UNAVAILABLE


class TestToolsCanBeImported:
    """Tests that verify the Attio tools can be imported and registered."""

    def test_register_attio_tools_runs(self):
        """Test that register_attio_tools can be called without error."""
        from fastmcp import FastMCP
        from atlas_gtm_mcp.attio import register_attio_tools

        mcp = FastMCP("test-attio")
        # Should not raise any errors
        register_attio_tools(mcp)

    def test_logging_module_imports(self):
        """Test that logging module can be imported."""
        from atlas_gtm_mcp.attio.logging import (
            log,
            log_api_call,
            log_tool_error,
            log_tool_result,
            generate_correlation_id,
        )

        # Test correlation ID generation
        corr_id = generate_correlation_id()
        assert isinstance(corr_id, str)
        assert len(corr_id) == 8

    def test_models_module_imports(self):
        """Test that models module can be imported."""
        from atlas_gtm_mcp.attio.models import (
            PipelineStage,
            ActivityType,
            AttioErrorType,
            PersonInput,
            ActivityInput,
            TaskInput,
            PipelineStageInput,
            validate_email,
            validate_non_empty_string,
            validate_record_id,
            validate_list_id,
            classify_http_error,
        )

        # All imports should succeed
        assert PipelineStage is not None
        assert ActivityType is not None


@requires_attio
@pytest.mark.integration
class TestAttioClientConfiguration:
    """Tests for Attio client configuration."""

    def test_client_requires_api_key(self):
        """Test that client raises error when API key is missing."""
        import os

        # Temporarily unset API key
        original_key = os.environ.get("ATTIO_API_KEY")
        try:
            if "ATTIO_API_KEY" in os.environ:
                del os.environ["ATTIO_API_KEY"]

            from atlas_gtm_mcp.attio import AttioClient

            with pytest.raises(ToolError, match="API key not configured"):
                AttioClient(api_key=None)
        finally:
            # Restore API key
            if original_key:
                os.environ["ATTIO_API_KEY"] = original_key


@requires_attio
@pytest.mark.integration
class TestAttioAPIIntegration:
    """Integration tests requiring Attio API access.

    These tests verify actual API interactions per SC-001.
    """

    @pytest.mark.asyncio
    async def test_find_person_not_found(self, test_email: str):
        """Test find_person returns None for non-existent email."""
        from fastmcp import FastMCP
        from atlas_gtm_mcp.attio import register_attio_tools

        mcp = FastMCP("test")
        register_attio_tools(mcp)

        # Get tools using async method
        tools = await mcp.get_tools()
        find_person_tool = next((t for t in tools if t.name == "find_person"), None)
        assert find_person_tool is not None

        # Call the tool function directly
        result = await find_person_tool.fn(email=test_email)
        assert result is None

    @pytest.mark.asyncio
    async def test_get_pipeline_records(self):
        """Test getting pipeline records (SC-001)."""
        from fastmcp import FastMCP
        from atlas_gtm_mcp.attio import register_attio_tools

        mcp = FastMCP("test")
        register_attio_tools(mcp)

        tools = await mcp.get_tools()
        get_pipeline_records_tool = next(
            (t for t in tools if t.name == "get_pipeline_records"), None
        )
        assert get_pipeline_records_tool is not None

        # Should return a list (may be empty)
        result = await get_pipeline_records_tool.fn(limit=10)
        assert isinstance(result, list)
