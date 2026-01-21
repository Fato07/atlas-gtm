"""Tests for HeyReach MCP models and validation utilities.

Tests verify:
- Enum validation (CampaignStatus, LeadStatus, AccountStatus, WebhookEventType)
- Input validation functions (linkedin_url, campaign_id, lead_id, message_content, uuid)
- Pydantic model validation (LeadInput, BulkLeadInput, MessageInput, WebhookInput)
- Error type classification
"""

from __future__ import annotations

import pytest

from atlas_gtm_mcp.heyreach.models import (
    AccountStatus,
    BulkLeadInput,
    CampaignStatus,
    HeyReachErrorType,
    LeadInput,
    LeadStatus,
    MessageInput,
    WebhookEventType,
    WebhookInput,
    classify_http_error,
    validate_campaign_id,
    validate_lead_id,
    validate_linkedin_url,
    validate_message_content,
    validate_non_empty_string,
    validate_uuid,
)


# =============================================================================
# Enum Tests
# =============================================================================


class TestCampaignStatus:
    """Tests for CampaignStatus enum."""

    def test_valid_values(self):
        """Test all valid campaign status values."""
        assert CampaignStatus.DRAFT.value == "DRAFT"
        assert CampaignStatus.ACTIVE.value == "ACTIVE"
        assert CampaignStatus.PAUSED.value == "PAUSED"
        assert CampaignStatus.COMPLETED.value == "COMPLETED"

    def test_values_method(self):
        """Test values() returns all status values."""
        values = CampaignStatus.values()
        assert "DRAFT" in values
        assert "ACTIVE" in values
        assert "PAUSED" in values
        assert "COMPLETED" in values
        assert len(values) == 4

    def test_validate_valid_status(self):
        """Test validate() accepts valid status strings."""
        assert CampaignStatus.validate("ACTIVE") is True
        assert CampaignStatus.validate("active") is True
        assert CampaignStatus.validate("Active") is True

    def test_validate_invalid_status(self):
        """Test validate() rejects invalid status strings."""
        assert CampaignStatus.validate("INVALID") is False
        assert CampaignStatus.validate("") is False
        assert CampaignStatus.validate("RUNNING") is False


class TestLeadStatus:
    """Tests for LeadStatus enum."""

    def test_valid_values(self):
        """Test all valid lead status values."""
        assert LeadStatus.NEW.value == "NEW"
        assert LeadStatus.CONTACTED.value == "CONTACTED"
        assert LeadStatus.CONNECTED.value == "CONNECTED"
        assert LeadStatus.REPLIED.value == "REPLIED"
        assert LeadStatus.INTERESTED.value == "INTERESTED"
        assert LeadStatus.NOT_INTERESTED.value == "NOT_INTERESTED"
        assert LeadStatus.MEETING_SCHEDULED.value == "MEETING_SCHEDULED"
        assert LeadStatus.COMPLETED.value == "COMPLETED"

    def test_values_method(self):
        """Test values() returns all status values."""
        values = LeadStatus.values()
        assert "NEW" in values
        assert "CONTACTED" in values
        assert "CONNECTED" in values
        assert "REPLIED" in values
        assert "INTERESTED" in values
        assert "NOT_INTERESTED" in values
        assert "MEETING_SCHEDULED" in values
        assert "COMPLETED" in values
        assert len(values) == 8

    def test_validate_valid_status(self):
        """Test validate() accepts valid status strings."""
        assert LeadStatus.validate("CONNECTED") is True
        assert LeadStatus.validate("replied") is True
        assert LeadStatus.validate("Meeting_Scheduled") is True

    def test_validate_invalid_status(self):
        """Test validate() rejects invalid status strings."""
        assert LeadStatus.validate("INVALID") is False
        assert LeadStatus.validate("BOUNCED") is False


class TestAccountStatus:
    """Tests for AccountStatus enum."""

    def test_valid_values(self):
        """Test all valid account status values."""
        assert AccountStatus.CONNECTED.value == "CONNECTED"
        assert AccountStatus.DISCONNECTED.value == "DISCONNECTED"
        assert AccountStatus.WARMING_UP.value == "WARMING_UP"
        assert AccountStatus.PAUSED.value == "PAUSED"
        assert AccountStatus.ERROR.value == "ERROR"

    def test_values_method(self):
        """Test values() returns all status values."""
        values = AccountStatus.values()
        assert "CONNECTED" in values
        assert "DISCONNECTED" in values
        assert "WARMING_UP" in values
        assert "PAUSED" in values
        assert "ERROR" in values
        assert len(values) == 5


class TestWebhookEventType:
    """Tests for WebhookEventType enum."""

    def test_valid_values(self):
        """Test all valid webhook event type values."""
        assert WebhookEventType.LEAD_REPLIED.value == "lead.replied"
        assert WebhookEventType.LEAD_CONNECTED.value == "lead.connected"
        assert WebhookEventType.LEAD_VIEWED_PROFILE.value == "lead.viewed_profile"
        assert WebhookEventType.CAMPAIGN_COMPLETED.value == "campaign.completed"
        assert WebhookEventType.ACCOUNT_DISCONNECTED.value == "account.disconnected"

    def test_values_method(self):
        """Test values() returns all event type values."""
        values = WebhookEventType.values()
        assert "lead.replied" in values
        assert "lead.connected" in values
        assert "lead.viewed_profile" in values
        assert "campaign.completed" in values
        assert "account.disconnected" in values
        assert len(values) == 5


# =============================================================================
# Validation Function Tests
# =============================================================================


class TestValidateLinkedInUrl:
    """Tests for validate_linkedin_url function."""

    def test_valid_urls(self):
        """Test that valid LinkedIn URLs are accepted."""
        assert validate_linkedin_url("https://linkedin.com/in/johndoe") is True
        assert validate_linkedin_url("https://www.linkedin.com/in/johndoe") is True
        assert validate_linkedin_url("http://linkedin.com/in/johndoe") is True
        assert validate_linkedin_url("https://linkedin.com/in/john-doe") is True
        assert validate_linkedin_url("https://linkedin.com/in/john_doe123") is True

    def test_invalid_urls(self):
        """Test that invalid URLs are rejected."""
        assert validate_linkedin_url("") is False
        assert validate_linkedin_url("https://google.com") is False
        assert validate_linkedin_url("https://linkedin.com/company/test") is False
        assert validate_linkedin_url("not a url") is False
        assert validate_linkedin_url(None) is False
        assert validate_linkedin_url(123) is False


class TestValidateNonEmptyString:
    """Tests for validate_non_empty_string function."""

    def test_valid_strings(self):
        """Test that valid non-empty strings are accepted."""
        assert validate_non_empty_string("hello", "test") == "hello"
        assert validate_non_empty_string("  hello  ", "test") == "hello"
        assert validate_non_empty_string("hello world", "test") == "hello world"

    def test_empty_strings_rejected(self):
        """Test that empty strings are rejected."""
        with pytest.raises(ValueError, match="cannot be empty"):
            validate_non_empty_string("", "test")

        with pytest.raises(ValueError, match="cannot be empty"):
            validate_non_empty_string("   ", "test")

    def test_non_strings_rejected(self):
        """Test that non-strings are rejected."""
        with pytest.raises(ValueError, match="must be a string"):
            validate_non_empty_string(123, "test")

        with pytest.raises(ValueError, match="must be a string"):
            validate_non_empty_string(None, "test")


class TestValidateUuid:
    """Tests for validate_uuid function."""

    def test_valid_uuids(self):
        """Test that valid UUIDs are accepted."""
        assert validate_uuid("550e8400-e29b-41d4-a716-446655440000") is True
        assert validate_uuid("AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE") is True

    def test_invalid_uuids(self):
        """Test that invalid UUIDs are rejected."""
        assert validate_uuid("") is False
        assert validate_uuid("not-a-uuid") is False
        assert validate_uuid("550e8400e29b41d4a716446655440000") is False  # No dashes
        assert validate_uuid(None) is False
        assert validate_uuid(123) is False


class TestValidateCampaignId:
    """Tests for validate_campaign_id function."""

    def test_valid_campaign_ids(self):
        """Test that valid campaign IDs are accepted."""
        assert validate_campaign_id("camp_hr_12345678901234567890") is True
        assert validate_campaign_id("abc123") is True
        assert validate_campaign_id("a" * 50) is True

    def test_invalid_campaign_ids(self):
        """Test that invalid campaign IDs are rejected."""
        assert validate_campaign_id("") is False
        assert validate_campaign_id("abc") is False  # Too short
        assert validate_campaign_id("abcd") is False  # Still too short
        assert validate_campaign_id("a" * 101) is False  # Too long
        assert validate_campaign_id(None) is False
        assert validate_campaign_id(123) is False


class TestValidateLeadId:
    """Tests for validate_lead_id function."""

    def test_valid_lead_ids(self):
        """Test that valid lead IDs are accepted."""
        assert validate_lead_id("lead_hr_12345678901234567890") is True
        assert validate_lead_id("abc12") is True
        assert validate_lead_id("a" * 50) is True

    def test_invalid_lead_ids(self):
        """Test that invalid lead IDs are rejected."""
        assert validate_lead_id("") is False
        assert validate_lead_id("abc") is False  # Too short
        assert validate_lead_id("a" * 101) is False  # Too long
        assert validate_lead_id(None) is False
        assert validate_lead_id(123) is False


class TestValidateMessageContent:
    """Tests for validate_message_content function."""

    def test_valid_content(self):
        """Test that valid message content is accepted."""
        assert validate_message_content("Hello!") is True
        assert validate_message_content("a") is True
        assert validate_message_content("a" * 8000) is True

    def test_invalid_content(self):
        """Test that invalid content is rejected."""
        assert validate_message_content("") is False
        assert validate_message_content("   ") is False
        assert validate_message_content("a" * 8001) is False  # Too long
        assert validate_message_content(None) is False
        assert validate_message_content(123) is False


# =============================================================================
# Error Classification Tests
# =============================================================================


class TestClassifyHttpError:
    """Tests for classify_http_error function."""

    def test_authentication_errors(self):
        """Test 401 errors are classified as authentication."""
        assert classify_http_error(401, "") == HeyReachErrorType.AUTHENTICATION

    def test_permission_errors(self):
        """Test 403 errors are classified as permission denied."""
        assert classify_http_error(403, "") == HeyReachErrorType.PERMISSION_DENIED

    def test_not_found_errors(self):
        """Test 404 errors are classified as not found."""
        assert classify_http_error(404, "") == HeyReachErrorType.NOT_FOUND

    def test_rate_limit_errors(self):
        """Test 429 errors are classified as rate limited."""
        assert classify_http_error(429, "") == HeyReachErrorType.RATE_LIMITED

    def test_validation_errors(self):
        """Test 422 errors are classified as validation."""
        assert classify_http_error(422, "") == HeyReachErrorType.VALIDATION

    def test_server_errors(self):
        """Test 5xx errors are classified as service unavailable."""
        assert classify_http_error(500, "") == HeyReachErrorType.SERVICE_UNAVAILABLE
        assert classify_http_error(502, "") == HeyReachErrorType.SERVICE_UNAVAILABLE
        assert classify_http_error(503, "") == HeyReachErrorType.SERVICE_UNAVAILABLE

    def test_bad_request_errors(self):
        """Test other 4xx errors are classified as bad request."""
        assert classify_http_error(400, "") == HeyReachErrorType.BAD_REQUEST

    def test_heyreach_specific_errors(self):
        """Test HeyReach-specific error classification from message content."""
        assert classify_http_error(400, "Account disconnected") == HeyReachErrorType.ACCOUNT_DISCONNECTED
        assert classify_http_error(400, "Account not connected") == HeyReachErrorType.ACCOUNT_DISCONNECTED
        assert classify_http_error(400, "Campaign not active") == HeyReachErrorType.CAMPAIGN_NOT_ACTIVE
        assert classify_http_error(400, "Campaign is paused") == HeyReachErrorType.CAMPAIGN_NOT_ACTIVE
        assert classify_http_error(400, "Daily limit reached") == HeyReachErrorType.DAILY_LIMIT_REACHED

    def test_retriable_classification(self):
        """Test that retriable errors are correctly identified."""
        assert HeyReachErrorType.is_retriable(HeyReachErrorType.RATE_LIMITED) is True
        assert HeyReachErrorType.is_retriable(HeyReachErrorType.NETWORK_ERROR) is True
        assert HeyReachErrorType.is_retriable(HeyReachErrorType.TIMEOUT) is True
        assert HeyReachErrorType.is_retriable(HeyReachErrorType.SERVICE_UNAVAILABLE) is True

    def test_non_retriable_classification(self):
        """Test that non-retriable errors are correctly identified."""
        assert HeyReachErrorType.is_retriable(HeyReachErrorType.AUTHENTICATION) is False
        assert HeyReachErrorType.is_retriable(HeyReachErrorType.NOT_FOUND) is False
        assert HeyReachErrorType.is_retriable(HeyReachErrorType.VALIDATION) is False
        assert HeyReachErrorType.is_retriable(HeyReachErrorType.ACCOUNT_DISCONNECTED) is False
        assert HeyReachErrorType.is_retriable(HeyReachErrorType.CAMPAIGN_NOT_ACTIVE) is False
        assert HeyReachErrorType.is_retriable(HeyReachErrorType.DAILY_LIMIT_REACHED) is False


# =============================================================================
# Pydantic Model Tests
# =============================================================================


class TestLeadInput:
    """Tests for LeadInput Pydantic model."""

    def test_valid_lead_input(self):
        """Test creating a valid lead input."""
        lead = LeadInput(
            linkedin_url="https://linkedin.com/in/johndoe",
            first_name="John",
            last_name="Doe",
            company="Example Corp",
        )
        assert lead.linkedin_url == "https://linkedin.com/in/johndoe"
        assert lead.first_name == "John"
        assert lead.last_name == "Doe"

    def test_lead_input_required_linkedin_url(self):
        """Test that linkedin_url is required."""
        with pytest.raises(Exception):  # ValidationError
            LeadInput(first_name="John")

    def test_lead_input_url_validation(self):
        """Test that invalid LinkedIn URL is rejected."""
        with pytest.raises(Exception):  # ValidationError
            LeadInput(linkedin_url="https://google.com/profile")

    def test_lead_input_with_tags(self):
        """Test lead input with tags."""
        lead = LeadInput(
            linkedin_url="https://linkedin.com/in/johndoe",
            tags=["decision-maker", "tech"],
        )
        assert lead.tags == ["decision-maker", "tech"]

    def test_lead_input_tag_length_limit(self):
        """Test tag length limit."""
        # Should accept tags up to 50 chars
        lead = LeadInput(
            linkedin_url="https://linkedin.com/in/johndoe",
            tags=["a" * 50],
        )
        assert len(lead.tags[0]) == 50

        # Should reject tags over 50 chars
        with pytest.raises(Exception):  # ValidationError
            LeadInput(
                linkedin_url="https://linkedin.com/in/johndoe",
                tags=["a" * 51],
            )

    def test_lead_input_name_length_limits(self):
        """Test name field length limits."""
        # Should accept reasonable length names
        lead = LeadInput(
            linkedin_url="https://linkedin.com/in/johndoe",
            first_name="A" * 100,
        )
        assert lead.first_name == "A" * 100

        # Should reject names that are too long
        with pytest.raises(Exception):  # ValidationError
            LeadInput(
                linkedin_url="https://linkedin.com/in/johndoe",
                first_name="A" * 101,
            )


class TestBulkLeadInput:
    """Tests for BulkLeadInput Pydantic model."""

    def test_valid_bulk_input(self):
        """Test creating valid bulk lead input."""
        bulk = BulkLeadInput(
            leads=[
                LeadInput(linkedin_url="https://linkedin.com/in/john"),
                LeadInput(linkedin_url="https://linkedin.com/in/jane"),
            ],
        )
        assert len(bulk.leads) == 2

    def test_bulk_input_requires_leads(self):
        """Test that leads list is required."""
        with pytest.raises(Exception):  # ValidationError
            BulkLeadInput()

    def test_bulk_input_max_leads(self):
        """Test that max 100 leads are allowed."""
        # Should accept 100 leads
        leads = [
            LeadInput(linkedin_url=f"https://linkedin.com/in/user{i}")
            for i in range(100)
        ]
        bulk = BulkLeadInput(leads=leads)
        assert len(bulk.leads) == 100

        # Should reject more than 100 leads
        leads_101 = [
            LeadInput(linkedin_url=f"https://linkedin.com/in/user{i}")
            for i in range(101)
        ]
        with pytest.raises(Exception):  # ValidationError
            BulkLeadInput(leads=leads_101)

    def test_bulk_input_empty_leads_rejected(self):
        """Test that empty leads list is rejected."""
        with pytest.raises(Exception):  # ValidationError
            BulkLeadInput(leads=[])


class TestMessageInput:
    """Tests for MessageInput Pydantic model."""

    def test_valid_message_input(self):
        """Test creating a valid message input."""
        msg = MessageInput(
            conversation_id="conv_12345",
            content="Hello, how are you?",
        )
        assert msg.conversation_id == "conv_12345"
        assert msg.content == "Hello, how are you?"

    def test_message_requires_conversation_id(self):
        """Test that conversation_id is required."""
        with pytest.raises(Exception):  # ValidationError
            MessageInput(content="Hello!")

    def test_message_requires_content(self):
        """Test that content is required."""
        with pytest.raises(Exception):  # ValidationError
            MessageInput(conversation_id="conv_12345")

    def test_message_content_length_limit(self):
        """Test message content length limits."""
        # Should accept up to 8000 chars
        msg = MessageInput(
            conversation_id="conv_12345",
            content="a" * 8000,
        )
        assert len(msg.content) == 8000

        # Should reject over 8000 chars
        with pytest.raises(Exception):  # ValidationError
            MessageInput(
                conversation_id="conv_12345",
                content="a" * 8001,
            )

    def test_message_empty_content_rejected(self):
        """Test that empty content is rejected."""
        with pytest.raises(Exception):  # ValidationError
            MessageInput(
                conversation_id="conv_12345",
                content="",
            )


class TestWebhookInput:
    """Tests for WebhookInput Pydantic model."""

    def test_valid_webhook_input(self):
        """Test creating a valid webhook input."""
        webhook = WebhookInput(
            url="https://example.com/webhook",
            events=["lead.replied", "lead.connected"],
        )
        assert webhook.url == "https://example.com/webhook"
        assert len(webhook.events) == 2

    def test_webhook_requires_url(self):
        """Test that url is required."""
        with pytest.raises(Exception):  # ValidationError
            WebhookInput(events=["lead.replied"])

    def test_webhook_requires_events(self):
        """Test that events list is required."""
        with pytest.raises(Exception):  # ValidationError
            WebhookInput(url="https://example.com/webhook")

    def test_webhook_validates_event_types(self):
        """Test that invalid event types are rejected."""
        with pytest.raises(Exception):  # ValidationError
            WebhookInput(
                url="https://example.com/webhook",
                events=["invalid.event"],
            )

    def test_webhook_empty_events_rejected(self):
        """Test that empty events list is rejected."""
        with pytest.raises(Exception):  # ValidationError
            WebhookInput(
                url="https://example.com/webhook",
                events=[],
            )

    def test_webhook_all_valid_events(self):
        """Test all valid event types are accepted."""
        webhook = WebhookInput(
            url="https://example.com/webhook",
            events=[
                "lead.replied",
                "lead.connected",
                "lead.viewed_profile",
                "campaign.completed",
                "account.disconnected",
            ],
        )
        assert len(webhook.events) == 5
