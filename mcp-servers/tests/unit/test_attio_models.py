"""Unit tests for Attio models and validation."""

import pytest

from atlas_gtm_mcp.attio.models import (
    ActivityType,
    AttioErrorType,
    PipelineStage,
    PersonInput,
    ActivityInput,
    TaskInput,
    PipelineStageInput,
    VALID_STAGE_TRANSITIONS,
    classify_http_error,
    validate_email,
    validate_list_id,
    validate_non_empty_string,
    validate_record_id,
    validate_stage_transition,
)


class TestPipelineStage:
    """Tests for PipelineStage enum."""

    def test_all_stages_defined(self):
        """Test that all 7 stages are defined per FR-014."""
        expected_stages = [
            "new_reply",
            "qualifying",
            "meeting_scheduled",
            "meeting_held",
            "proposal",
            "closed_won",
            "closed_lost",
        ]
        assert PipelineStage.values() == expected_stages

    def test_validate_valid_stage(self):
        """Test validation of valid stages."""
        for stage in PipelineStage.values():
            assert PipelineStage.validate(stage) is True

    def test_validate_invalid_stage(self):
        """Test validation rejects invalid stages."""
        assert PipelineStage.validate("invalid_stage") is False
        assert PipelineStage.validate("") is False
        assert PipelineStage.validate("QUALIFYING") is False  # Case sensitive


class TestStageTransitions:
    """Tests for pipeline stage transition validation."""

    def test_valid_transitions_from_new_reply(self):
        """Test valid transitions from new_reply stage."""
        assert validate_stage_transition("new_reply", "qualifying") is True
        assert validate_stage_transition("new_reply", "closed_lost") is True

    def test_invalid_transitions_from_new_reply(self):
        """Test invalid transitions from new_reply stage."""
        assert validate_stage_transition("new_reply", "meeting_held") is False
        assert validate_stage_transition("new_reply", "closed_won") is False

    def test_terminal_states(self):
        """Test that terminal states have no valid transitions."""
        assert VALID_STAGE_TRANSITIONS["closed_won"] == []
        assert VALID_STAGE_TRANSITIONS["closed_lost"] == []
        assert validate_stage_transition("closed_won", "qualifying") is False


class TestActivityType:
    """Tests for ActivityType enum."""

    def test_all_types_defined(self):
        """Test that all 4 activity types are defined per FR-021."""
        expected_types = ["note", "email", "call", "meeting"]
        assert ActivityType.values() == expected_types

    def test_validate_valid_type(self):
        """Test validation of valid activity types."""
        for activity_type in ActivityType.values():
            assert ActivityType.validate(activity_type) is True

    def test_validate_invalid_type(self):
        """Test validation rejects invalid types."""
        assert ActivityType.validate("sms") is False
        assert ActivityType.validate("") is False
        assert ActivityType.validate("NOTE") is False  # Case sensitive


class TestEmailValidation:
    """Tests for email validation (FR-019)."""

    def test_valid_emails(self):
        """Test that valid emails pass validation."""
        valid_emails = [
            "user@example.com",
            "user.name@example.com",
            "user+tag@example.com",
            "user@subdomain.example.com",
            "user@example.co.uk",
        ]
        for email in valid_emails:
            assert validate_email(email) is True, f"Expected {email} to be valid"

    def test_invalid_emails(self):
        """Test that invalid emails fail validation."""
        invalid_emails = [
            "",
            "invalid",
            "invalid@",
            "@example.com",
            "user@.com",
            "user@example.",
            None,
            123,
        ]
        for email in invalid_emails:
            assert validate_email(email) is False, f"Expected {email} to be invalid"


class TestNonEmptyStringValidation:
    """Tests for non-empty string validation (FR-020)."""

    def test_valid_strings(self):
        """Test that valid strings pass validation."""
        result = validate_non_empty_string("hello", "field")
        assert result == "hello"

    def test_whitespace_trimming(self):
        """Test that whitespace is trimmed."""
        result = validate_non_empty_string("  hello  ", "field")
        assert result == "hello"

    def test_empty_string_raises(self):
        """Test that empty string raises ValueError."""
        with pytest.raises(ValueError, match="field cannot be empty"):
            validate_non_empty_string("", "field")

    def test_whitespace_only_raises(self):
        """Test that whitespace-only string raises ValueError."""
        with pytest.raises(ValueError, match="field cannot be empty"):
            validate_non_empty_string("   ", "field")

    def test_non_string_raises(self):
        """Test that non-string raises ValueError."""
        with pytest.raises(ValueError, match="field must be a string"):
            validate_non_empty_string(123, "field")


class TestRecordIdValidation:
    """Tests for record ID validation."""

    def test_valid_record_ids(self):
        """Test that valid record IDs pass validation."""
        valid_ids = [
            "rec_abc123def456",
            "12345678901234567890",
            "a" * 10,
            "uuid-style-id-here-with-dashes",
        ]
        for record_id in valid_ids:
            assert validate_record_id(record_id) is True

    def test_invalid_record_ids(self):
        """Test that invalid record IDs fail validation."""
        invalid_ids = [
            "",
            "short",
            None,
            "a" * 101,  # Too long
        ]
        for record_id in invalid_ids:
            assert validate_record_id(record_id) is False


class TestListIdValidation:
    """Tests for list ID validation."""

    def test_valid_list_ids(self):
        """Test that valid list IDs pass validation."""
        valid_ids = [
            "list_12345",
            "my-pipeline-list",
            "12345",
        ]
        for list_id in valid_ids:
            assert validate_list_id(list_id) is True

    def test_invalid_list_ids(self):
        """Test that invalid list IDs fail validation."""
        invalid_ids = [
            "",
            "ab",  # Too short
            None,
            "a" * 101,  # Too long
        ]
        for list_id in invalid_ids:
            assert validate_list_id(list_id) is False


class TestHttpErrorClassification:
    """Tests for HTTP error classification (FR-017)."""

    def test_authentication_errors(self):
        """Test 401 is classified as authentication error."""
        assert classify_http_error(401) == AttioErrorType.AUTHENTICATION

    def test_permission_errors(self):
        """Test 403 is classified as permission denied."""
        assert classify_http_error(403) == AttioErrorType.PERMISSION_DENIED

    def test_not_found_errors(self):
        """Test 404 is classified as not found."""
        assert classify_http_error(404) == AttioErrorType.NOT_FOUND

    def test_rate_limit_errors(self):
        """Test 429 is classified as rate limited."""
        assert classify_http_error(429) == AttioErrorType.RATE_LIMITED

    def test_server_errors(self):
        """Test 5xx errors are classified as service unavailable."""
        assert classify_http_error(500) == AttioErrorType.SERVICE_UNAVAILABLE
        assert classify_http_error(503) == AttioErrorType.SERVICE_UNAVAILABLE

    def test_retriable_errors(self):
        """Test retriable error classification."""
        retriable = [
            AttioErrorType.RATE_LIMITED,
            AttioErrorType.NETWORK_ERROR,
            AttioErrorType.TIMEOUT,
            AttioErrorType.SERVICE_UNAVAILABLE,
        ]
        for error_type in retriable:
            assert AttioErrorType.is_retriable(error_type) is True

    def test_non_retriable_errors(self):
        """Test non-retriable error classification."""
        non_retriable = [
            AttioErrorType.AUTHENTICATION,
            AttioErrorType.VALIDATION,
            AttioErrorType.NOT_FOUND,
            AttioErrorType.PERMISSION_DENIED,
        ]
        for error_type in non_retriable:
            assert AttioErrorType.is_retriable(error_type) is False


class TestPersonInputModel:
    """Tests for PersonInput Pydantic model."""

    def test_valid_person_input(self):
        """Test valid person input is accepted."""
        person = PersonInput(
            email="test@example.com",
            name="John Doe",
            company="Acme Inc",
            title="Engineer",
        )
        assert person.email == "test@example.com"
        assert person.name == "John Doe"

    def test_email_normalized(self):
        """Test email is lowercased and trimmed."""
        person = PersonInput(
            email="  TEST@EXAMPLE.COM  ",
            name="John Doe",
        )
        assert person.email == "test@example.com"

    def test_invalid_email_rejected(self):
        """Test invalid email raises validation error."""
        with pytest.raises(ValueError, match="Invalid email format"):
            PersonInput(email="invalid", name="John Doe")

    def test_linkedin_url_validated(self):
        """Test LinkedIn URL validation."""
        with pytest.raises(ValueError, match="LinkedIn"):
            PersonInput(
                email="test@example.com",
                name="John Doe",
                linkedin_url="https://twitter.com/user",
            )


class TestActivityInputModel:
    """Tests for ActivityInput Pydantic model."""

    def test_valid_activity_input(self):
        """Test valid activity input is accepted."""
        activity = ActivityInput(
            record_id="rec_abc123def456",
            activity_type="note",
            content="Meeting notes here",
        )
        assert activity.activity_type == "note"

    def test_invalid_activity_type_rejected(self):
        """Test invalid activity type raises validation error."""
        with pytest.raises(ValueError, match="Invalid activity_type"):
            ActivityInput(
                record_id="rec_abc123def456",
                activity_type="sms",
                content="Content",
            )


class TestTaskInputModel:
    """Tests for TaskInput Pydantic model."""

    def test_valid_task_input(self):
        """Test valid task input is accepted."""
        task = TaskInput(
            record_id="rec_abc123def456",
            content="Follow up call",
            deadline_at="2024-12-31",
        )
        assert task.deadline_at == "2024-12-31"

    def test_invalid_deadline_rejected(self):
        """Test invalid deadline raises validation error."""
        with pytest.raises(ValueError, match="ISO format"):
            TaskInput(
                record_id="rec_abc123def456",
                content="Follow up",
                deadline_at="31/12/2024",
            )

    def test_valid_iso_timestamp(self):
        """Test ISO timestamp is accepted."""
        task = TaskInput(
            record_id="rec_abc123def456",
            content="Follow up",
            deadline_at="2024-12-31T14:30:00Z",
        )
        assert task.deadline_at == "2024-12-31T14:30:00Z"


class TestPipelineStageInputModel:
    """Tests for PipelineStageInput Pydantic model."""

    def test_valid_stage_input(self):
        """Test valid stage input is accepted."""
        stage_input = PipelineStageInput(
            record_id="rec_abc123def456",
            stage="qualifying",
        )
        assert stage_input.stage == "qualifying"

    def test_invalid_stage_rejected(self):
        """Test invalid stage raises validation error."""
        with pytest.raises(ValueError, match="Invalid stage"):
            PipelineStageInput(
                record_id="rec_abc123def456",
                stage="invalid_stage",
            )
