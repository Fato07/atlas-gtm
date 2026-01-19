"""Attio data models and validation utilities.

Provides:
- Pipeline stage enum and validation (FR-014, FR-015)
- Activity type enum and validation (FR-021)
- Input validation functions (FR-019, FR-020)
- Pydantic models for structured data
"""

from __future__ import annotations

import re
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator

# =============================================================================
# Pipeline Stages (FR-014)
# =============================================================================


class PipelineStage(str, Enum):
    """Valid pipeline stages for GTM workflows.

    Per FR-014: new_reply, qualifying, meeting_scheduled, meeting_held,
    proposal, closed_won, closed_lost
    """

    NEW_REPLY = "new_reply"
    QUALIFYING = "qualifying"
    MEETING_SCHEDULED = "meeting_scheduled"
    MEETING_HELD = "meeting_held"
    PROPOSAL = "proposal"
    CLOSED_WON = "closed_won"
    CLOSED_LOST = "closed_lost"

    @classmethod
    def values(cls) -> list[str]:
        """Return all valid stage values."""
        return [stage.value for stage in cls]

    @classmethod
    def validate(cls, stage: str) -> bool:
        """Check if a stage name is valid."""
        return stage in cls.values()


# Valid stage transitions for workflow validation
VALID_STAGE_TRANSITIONS: dict[str, list[str]] = {
    PipelineStage.NEW_REPLY.value: [
        PipelineStage.QUALIFYING.value,
        PipelineStage.CLOSED_LOST.value,
    ],
    PipelineStage.QUALIFYING.value: [
        PipelineStage.MEETING_SCHEDULED.value,
        PipelineStage.CLOSED_LOST.value,
    ],
    PipelineStage.MEETING_SCHEDULED.value: [
        PipelineStage.MEETING_HELD.value,
        PipelineStage.CLOSED_LOST.value,
    ],
    PipelineStage.MEETING_HELD.value: [
        PipelineStage.PROPOSAL.value,
        PipelineStage.CLOSED_LOST.value,
    ],
    PipelineStage.PROPOSAL.value: [
        PipelineStage.CLOSED_WON.value,
        PipelineStage.CLOSED_LOST.value,
    ],
    PipelineStage.CLOSED_WON.value: [],  # Terminal state
    PipelineStage.CLOSED_LOST.value: [],  # Terminal state
}


def validate_stage_transition(from_stage: str, to_stage: str) -> bool:
    """Validate that a stage transition is allowed.

    Args:
        from_stage: Current stage
        to_stage: Target stage

    Returns:
        True if transition is valid, False otherwise
    """
    if from_stage not in VALID_STAGE_TRANSITIONS:
        return False
    return to_stage in VALID_STAGE_TRANSITIONS[from_stage]


# =============================================================================
# Activity Types (FR-021)
# =============================================================================


class ActivityType(str, Enum):
    """Valid activity types for CRM logging."""

    NOTE = "note"
    EMAIL = "email"
    CALL = "call"
    MEETING = "meeting"

    @classmethod
    def values(cls) -> list[str]:
        """Return all valid activity type values."""
        return [t.value for t in cls]

    @classmethod
    def validate(cls, activity_type: str) -> bool:
        """Check if an activity type is valid."""
        return activity_type in cls.values()


# =============================================================================
# Input Validation (FR-019, FR-020)
# =============================================================================


# Email validation regex (basic RFC 5322 compliant)
EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
)


def validate_email(email: str) -> bool:
    """Validate email format (FR-019).

    Args:
        email: Email address to validate

    Returns:
        True if email format is valid, False otherwise
    """
    if not email or not isinstance(email, str):
        return False
    return bool(EMAIL_REGEX.match(email.strip()))


def validate_non_empty_string(value: str, field_name: str) -> str:
    """Validate that a string is non-empty (FR-020).

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


def validate_record_id(record_id: str) -> bool:
    """Validate Attio record ID format.

    Args:
        record_id: Record ID to validate

    Returns:
        True if format looks valid, False otherwise
    """
    if not record_id or not isinstance(record_id, str):
        return False
    # Attio record IDs are typically UUIDs or prefixed IDs
    trimmed = record_id.strip()
    return len(trimmed) >= 10 and len(trimmed) <= 100


def validate_list_id(list_id: str) -> bool:
    """Validate Attio list/pipeline ID format.

    Args:
        list_id: List ID to validate

    Returns:
        True if format looks valid, False otherwise
    """
    if not list_id or not isinstance(list_id, str):
        return False
    trimmed = list_id.strip()
    return len(trimmed) >= 5 and len(trimmed) <= 100


# =============================================================================
# Pydantic Models for Structured Data
# =============================================================================


class PersonInput(BaseModel):
    """Input model for creating/updating a person."""

    email: str = Field(..., description="Email address (required)")
    name: str = Field(..., min_length=1, max_length=200, description="Full name")
    company: str | None = Field(None, max_length=200, description="Company name")
    title: str | None = Field(None, max_length=100, description="Job title")
    linkedin_url: str | None = Field(None, max_length=500, description="LinkedIn URL")

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        if not validate_email(v):
            raise ValueError("Invalid email format")
        return v.strip().lower()

    @field_validator("linkedin_url")
    @classmethod
    def validate_linkedin_url(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if not v.startswith("http"):
            v = f"https://{v}"
        if "linkedin.com" not in v.lower():
            raise ValueError("URL must be a LinkedIn profile")
        return v


class ActivityInput(BaseModel):
    """Input model for adding an activity/note via Attio Notes API."""

    record_id: str = Field(..., description="Record ID to add activity to")
    activity_type: str = Field(..., description="Type: note, email, call, meeting")
    content: str = Field(..., min_length=1, max_length=10000, description="Activity content")
    parent_object: str = Field("people", description="Object type the record belongs to")

    @field_validator("activity_type")
    @classmethod
    def validate_activity_type(cls, v: str) -> str:
        if not ActivityType.validate(v):
            valid = ActivityType.values()
            raise ValueError(f"Invalid activity_type: {v}. Valid types: {valid}")
        return v

    @field_validator("record_id")
    @classmethod
    def validate_record(cls, v: str) -> str:
        if not validate_record_id(v):
            raise ValueError("Invalid record_id format")
        return v.strip()


class TaskInput(BaseModel):
    """Input model for creating a task via Attio Tasks API."""

    record_id: str = Field(..., description="Record ID to link task to")
    content: str = Field(..., min_length=1, max_length=5000, description="Task content")
    deadline_at: str | None = Field(None, description="Deadline (ISO format)")
    assignee_id: str | None = Field(None, description="Workspace member ID to assign to")
    target_object: str = Field("people", description="Object type the record belongs to")

    @field_validator("record_id")
    @classmethod
    def validate_record(cls, v: str) -> str:
        if not validate_record_id(v):
            raise ValueError("Invalid record_id format")
        return v.strip()

    @field_validator("deadline_at")
    @classmethod
    def validate_deadline_format(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        # Basic ISO date format check (YYYY-MM-DD or full ISO timestamp)
        iso_date_regex = re.compile(
            r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$"
        )
        if not iso_date_regex.match(v):
            raise ValueError("deadline_at must be in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS.sssZ)")
        return v


class PipelineStageInput(BaseModel):
    """Input model for updating pipeline stage."""

    record_id: str = Field(..., description="Record ID")
    stage: str = Field(..., description="Target pipeline stage")

    @field_validator("record_id")
    @classmethod
    def validate_record(cls, v: str) -> str:
        if not validate_record_id(v):
            raise ValueError("Invalid record_id format")
        return v.strip()

    @field_validator("stage")
    @classmethod
    def validate_pipeline_stage(cls, v: str) -> str:
        if not PipelineStage.validate(v):
            valid = PipelineStage.values()
            raise ValueError(f"Invalid stage: {v}. Valid stages: {valid}")
        return v


# =============================================================================
# Error Types for Classification (FR-017)
# =============================================================================


class AttioErrorType(str, Enum):
    """Classification of Attio errors for handling strategy."""

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
    CONFLICT = "conflict"
    BAD_REQUEST = "bad_request"
    UNKNOWN = "unknown"

    @classmethod
    def is_retriable(cls, error_type: "AttioErrorType") -> bool:
        """Check if an error type should be retried."""
        return error_type in {
            cls.RATE_LIMITED,
            cls.NETWORK_ERROR,
            cls.TIMEOUT,
            cls.SERVICE_UNAVAILABLE,
        }


def classify_http_error(status_code: int) -> AttioErrorType:
    """Classify HTTP status code into error type.

    Args:
        status_code: HTTP response status code

    Returns:
        AttioErrorType classification
    """
    if status_code == 401:
        return AttioErrorType.AUTHENTICATION
    elif status_code == 403:
        return AttioErrorType.PERMISSION_DENIED
    elif status_code == 404:
        return AttioErrorType.NOT_FOUND
    elif status_code == 409:
        return AttioErrorType.CONFLICT
    elif status_code == 422:
        return AttioErrorType.VALIDATION
    elif status_code == 429:
        return AttioErrorType.RATE_LIMITED
    elif status_code >= 400 and status_code < 500:
        return AttioErrorType.BAD_REQUEST
    elif status_code >= 500 and status_code < 600:
        return AttioErrorType.SERVICE_UNAVAILABLE
    else:
        return AttioErrorType.UNKNOWN
