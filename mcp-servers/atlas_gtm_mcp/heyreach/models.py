"""HeyReach data models and validation utilities.

Provides:
- Campaign status enum and validation
- Lead status enum
- Error type classification
- Input validation functions
- Pydantic models for structured data
"""

from __future__ import annotations

import re
from enum import Enum

from pydantic import BaseModel, Field, field_validator

# =============================================================================
# Campaign Status
# =============================================================================


class CampaignStatus(str, Enum):
    """Valid campaign statuses in HeyReach."""

    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"

    @classmethod
    def values(cls) -> list[str]:
        """Return all valid status values."""
        return [status.value for status in cls]

    @classmethod
    def validate(cls, status: str) -> bool:
        """Check if a status name is valid."""
        return status.upper() in cls.values()


# =============================================================================
# Lead Status
# =============================================================================


class LeadStatus(str, Enum):
    """Valid lead statuses in HeyReach."""

    NEW = "NEW"
    CONTACTED = "CONTACTED"
    CONNECTED = "CONNECTED"
    REPLIED = "REPLIED"
    INTERESTED = "INTERESTED"
    NOT_INTERESTED = "NOT_INTERESTED"
    MEETING_SCHEDULED = "MEETING_SCHEDULED"
    COMPLETED = "COMPLETED"

    @classmethod
    def values(cls) -> list[str]:
        """Return all valid status values."""
        return [status.value for status in cls]

    @classmethod
    def validate(cls, status: str) -> bool:
        """Check if a status name is valid."""
        return status.upper() in cls.values()


# =============================================================================
# Account Status
# =============================================================================


class AccountStatus(str, Enum):
    """Valid LinkedIn account statuses in HeyReach."""

    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"
    WARMING_UP = "WARMING_UP"
    PAUSED = "PAUSED"
    ERROR = "ERROR"

    @classmethod
    def values(cls) -> list[str]:
        """Return all valid status values."""
        return [status.value for status in cls]


# =============================================================================
# Webhook Event Types
# =============================================================================


class WebhookEventType(str, Enum):
    """Valid webhook event types in HeyReach."""

    LEAD_REPLIED = "lead.replied"
    LEAD_CONNECTED = "lead.connected"
    LEAD_VIEWED_PROFILE = "lead.viewed_profile"
    CAMPAIGN_COMPLETED = "campaign.completed"
    ACCOUNT_DISCONNECTED = "account.disconnected"

    @classmethod
    def values(cls) -> list[str]:
        """Return all valid event type values."""
        return [event.value for event in cls]


# =============================================================================
# Input Validation
# =============================================================================

# LinkedIn URL validation regex
LINKEDIN_URL_REGEX = re.compile(r"https?://(www\.)?linkedin\.com/in/[A-Za-z0-9\-_%]+/?")


def validate_linkedin_url(url: str) -> bool:
    """Validate LinkedIn profile URL format.

    Args:
        url: LinkedIn URL to validate

    Returns:
        True if URL format is valid, False otherwise
    """
    if not url or not isinstance(url, str):
        return False
    return bool(LINKEDIN_URL_REGEX.match(url.strip()))


def validate_non_empty_string(value: str, field_name: str) -> str:
    """Validate that a string is non-empty.

    Args:
        value: String value to validate
        field_name: Name of the field for error messages

    Returns:
        The trimmed string value

    Raises:
        ValueError: If string is empty or not a string
    """
    if not isinstance(value, str):
        raise ValueError(f"{field_name} must be a string")
    trimmed = value.strip()
    if not trimmed:
        raise ValueError(f"{field_name} cannot be empty")
    return trimmed


def validate_uuid(uuid_str: str) -> bool:
    """Validate UUID format.

    Args:
        uuid_str: UUID string to validate

    Returns:
        True if format looks valid, False otherwise
    """
    if not uuid_str or not isinstance(uuid_str, str):
        return False
    trimmed = uuid_str.strip()
    # UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    uuid_pattern = (
        r"^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-"
        r"[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$"
    )
    return bool(re.match(uuid_pattern, trimmed))


def validate_campaign_id(campaign_id: str) -> bool:
    """Validate HeyReach campaign ID format.

    Args:
        campaign_id: Campaign ID to validate

    Returns:
        True if format looks valid, False otherwise
    """
    if not campaign_id or not isinstance(campaign_id, str):
        return False
    trimmed = campaign_id.strip()
    return len(trimmed) >= 5 and len(trimmed) <= 100


def validate_lead_id(lead_id: str) -> bool:
    """Validate HeyReach lead ID format.

    Args:
        lead_id: Lead ID to validate

    Returns:
        True if format looks valid, False otherwise
    """
    if not lead_id or not isinstance(lead_id, str):
        return False
    trimmed = lead_id.strip()
    return len(trimmed) >= 5 and len(trimmed) <= 100


def validate_message_content(content: str) -> bool:
    """Validate LinkedIn message content.

    Args:
        content: Message content to validate

    Returns:
        True if content is valid (non-empty, max 8000 chars)
    """
    if not content or not isinstance(content, str):
        return False
    trimmed = content.strip()
    return len(trimmed) > 0 and len(trimmed) <= 8000


# =============================================================================
# Pydantic Models for Structured Data
# =============================================================================


class LeadInput(BaseModel):
    """Input model for adding a lead."""

    linkedin_url: str = Field(..., description="LinkedIn profile URL (required)")
    first_name: str | None = Field(None, max_length=100, description="First name")
    last_name: str | None = Field(None, max_length=100, description="Last name")
    company: str | None = Field(None, max_length=200, description="Company name")
    title: str | None = Field(None, max_length=200, description="Job title")
    email: str | None = Field(None, max_length=200, description="Email address")
    tags: list[str] | None = Field(None, description="Tags for the lead")

    @field_validator("linkedin_url")
    @classmethod
    def validate_linkedin_url_format(cls, v: str) -> str:
        if not validate_linkedin_url(v):
            raise ValueError("Invalid LinkedIn URL format. Expected: https://linkedin.com/in/...")
        return v.strip()

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        for tag in v:
            if len(tag) > 50:
                raise ValueError("Tag must be max 50 characters")
        return v


class BulkLeadInput(BaseModel):
    """Input model for bulk adding leads."""

    leads: list[LeadInput] = Field(..., min_length=1, max_length=100)

    @field_validator("leads")
    @classmethod
    def validate_lead_count(cls, v: list[LeadInput]) -> list[LeadInput]:
        if len(v) > 100:
            raise ValueError("Maximum 100 leads per bulk operation")
        return v


class MessageInput(BaseModel):
    """Input model for sending a message."""

    conversation_id: str = Field(..., description="Conversation ID")
    content: str = Field(..., min_length=1, max_length=8000, description="Message content")

    @field_validator("content")
    @classmethod
    def validate_message_content(cls, v: str) -> str:
        if not validate_message_content(v):
            raise ValueError("Message content must be 1-8000 characters")
        return v.strip()


class WebhookInput(BaseModel):
    """Input model for creating a webhook."""

    url: str = Field(..., description="Webhook callback URL")
    events: list[str] = Field(..., min_length=1, description="Event types to subscribe to")

    @field_validator("events")
    @classmethod
    def validate_events(cls, v: list[str]) -> list[str]:
        valid_events = WebhookEventType.values()
        for event in v:
            if event not in valid_events:
                raise ValueError(f"Invalid event type: {event}. Valid types: {valid_events}")
        return v


# =============================================================================
# Error Types for Classification
# =============================================================================


class HeyReachErrorType(str, Enum):
    """Classification of HeyReach errors for handling strategy."""

    # Retriable errors
    RATE_LIMITED = "rate_limited"
    NETWORK_ERROR = "network_error"
    TIMEOUT = "timeout"
    SERVICE_UNAVAILABLE = "service_unavailable"

    # Non-retriable errors
    AUTHENTICATION = "authentication"
    VALIDATION = "validation"
    NOT_FOUND = "not_found"
    PERMISSION_DENIED = "permission_denied"
    ACCOUNT_DISCONNECTED = "account_disconnected"
    CAMPAIGN_NOT_ACTIVE = "campaign_not_active"
    DAILY_LIMIT_REACHED = "daily_limit_reached"
    BAD_REQUEST = "bad_request"
    UNKNOWN = "unknown"

    @classmethod
    def is_retriable(cls, error_type: "HeyReachErrorType") -> bool:
        """Check if an error type should be retried."""
        return error_type in {
            cls.RATE_LIMITED,
            cls.NETWORK_ERROR,
            cls.TIMEOUT,
            cls.SERVICE_UNAVAILABLE,
        }


def classify_http_error(status_code: int, error_message: str = "") -> HeyReachErrorType:
    """Classify HTTP status code into error type.

    Args:
        status_code: HTTP response status code
        error_message: Optional error message for more specific classification

    Returns:
        HeyReachErrorType classification
    """
    error_lower = error_message.lower()

    if status_code == 401:
        return HeyReachErrorType.AUTHENTICATION
    elif status_code == 403:
        return HeyReachErrorType.PERMISSION_DENIED
    elif status_code == 404:
        return HeyReachErrorType.NOT_FOUND
    elif status_code == 429:
        return HeyReachErrorType.RATE_LIMITED
    elif status_code == 422:
        return HeyReachErrorType.VALIDATION
    elif status_code >= 400 and status_code < 500:
        if "disconnected" in error_lower or "not connected" in error_lower:
            return HeyReachErrorType.ACCOUNT_DISCONNECTED
        if "campaign" in error_lower and ("not active" in error_lower or "paused" in error_lower):
            return HeyReachErrorType.CAMPAIGN_NOT_ACTIVE
        if "limit" in error_lower and "reached" in error_lower:
            return HeyReachErrorType.DAILY_LIMIT_REACHED
        return HeyReachErrorType.BAD_REQUEST
    elif status_code >= 500 and status_code < 600:
        return HeyReachErrorType.SERVICE_UNAVAILABLE
    else:
        return HeyReachErrorType.UNKNOWN


# =============================================================================
# Response Models
# =============================================================================


class LinkedInAccount(BaseModel):
    """HeyReach LinkedIn account."""

    id: str
    name: str | None = None
    linkedin_url: str | None = None
    status: str | None = None
    daily_connection_limit: int | None = None
    daily_message_limit: int | None = None
    connections_sent_today: int | None = None
    messages_sent_today: int | None = None


class Campaign(BaseModel):
    """HeyReach campaign."""

    id: str
    name: str
    status: str | None = None
    linkedin_account_ids: list[str] | None = None
    lead_count: int | None = None
    created_at: str | None = None
    updated_at: str | None = None


class Lead(BaseModel):
    """HeyReach lead."""

    id: str
    linkedin_url: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    company: str | None = None
    title: str | None = None
    email: str | None = None
    tags: list[str] | None = None
    status: str | None = None


class Conversation(BaseModel):
    """HeyReach conversation."""

    id: str
    lead_id: str | None = None
    lead_name: str | None = None
    last_message: str | None = None
    last_message_at: str | None = None
    unread: bool = False


class Message(BaseModel):
    """HeyReach message."""

    id: str
    conversation_id: str | None = None
    sender: str | None = None  # "me" or lead name
    content: str | None = None
    sent_at: str | None = None
    read: bool = False


class LeadList(BaseModel):
    """HeyReach lead list."""

    id: str
    name: str
    lead_count: int | None = None
    created_at: str | None = None


class Webhook(BaseModel):
    """HeyReach webhook subscription."""

    id: str
    url: str
    events: list[str] | None = None
    active: bool = True
    created_at: str | None = None


class Stats(BaseModel):
    """HeyReach statistics."""

    connections_sent: int = 0
    connections_accepted: int = 0
    messages_sent: int = 0
    messages_replied: int = 0
    profile_views: int = 0
