"""HeyReach LinkedIn Automation MCP Server.

Production-quality MCP server for HeyReach LinkedIn automation with:
- 35 tools across 8 categories (Authentication, Campaigns, Inbox, Accounts,
  Lists, Leads, Stats, Webhooks)
- X-API-KEY authentication via HEYREACH_API_KEY environment variable
- Rate limiting (300 req/min) with exponential backoff
- Structured JSON logging with correlation IDs
- Comprehensive error handling with ToolError for user-friendly messages
"""

from __future__ import annotations

import time
from typing import Any

from fastmcp import FastMCP
from fastmcp.exceptions import ToolError

from .client import (
    HeyReachAPIError,
    get_heyreach_client,
)
from .logging import generate_correlation_id, log_tool_error, log_tool_result
from .models import (
    BulkLeadInput,
    CampaignStatus,
    LeadInput,
    LeadStatus,
    MessageInput,
    WebhookInput,
    validate_campaign_id,
    validate_lead_id,
    validate_message_content,
)

# =============================================================================
# MCP Server Initialization
# =============================================================================

mcp = FastMCP("heyreach")


def _handle_api_error(error: HeyReachAPIError, operation: str) -> None:
    """Convert API errors to user-friendly ToolErrors.

    Args:
        error: The API error that occurred
        operation: Description of the operation that failed

    Raises:
        ToolError: Always raises with user-friendly message
    """
    raise ToolError(f"{operation} failed: {error}") from error


# =============================================================================
# Authentication Tools (1 tool)
# =============================================================================


@mcp.tool()
async def check_api_key() -> dict[str, Any]:
    """Verify that the HeyReach API key is valid and working.

    Returns:
        dict: API key status with validation result and account info.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params: dict[str, Any] = {}

    try:
        client = get_heyreach_client()
        # Use list sender accounts as a validation endpoint
        result = await client.get("/linkedin-accounts", correlation_id=correlation_id)
        log_tool_result("check_api_key", params, result, start_time, correlation_id)
        return {
            "valid": True,
            "message": "API key is valid",
            "account_count": len(result) if isinstance(result, list) else 1,
        }
    except HeyReachAPIError as e:
        log_tool_error("check_api_key", params, e, start_time, correlation_id)
        if "authentication" in str(e).lower() or "401" in str(e):
            return {
                "valid": False,
                "message": "API key is invalid or expired",
            }
        _handle_api_error(e, "API key validation")


# =============================================================================
# Campaign Tools (7 tools)
# =============================================================================


@mcp.tool()
async def list_campaigns(
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict[str, Any]:
    """List all HeyReach campaigns with optional status filtering.

    Args:
        status: Filter by campaign status (DRAFT, ACTIVE, PAUSED, COMPLETED).
        limit: Maximum number of campaigns to return (default 100).
        offset: Number of campaigns to skip for pagination.

    Returns:
        dict: List of campaigns with pagination metadata.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params: dict[str, Any] = {"limit": limit, "offset": offset}

    if status:
        if not CampaignStatus.validate(status):
            raise ToolError(
                f"Invalid status '{status}'. Valid values: {CampaignStatus.values()}"
            )
        params["status"] = status.upper()

    try:
        client = get_heyreach_client()
        result = await client.get("/campaigns", correlation_id=correlation_id, params=params)
        log_tool_result("list_campaigns", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("list_campaigns", params, e, start_time, correlation_id)
        _handle_api_error(e, "List campaigns")


@mcp.tool()
async def get_campaign(campaign_id: str) -> dict[str, Any]:
    """Get detailed information about a specific campaign.

    Args:
        campaign_id: The unique identifier of the campaign.

    Returns:
        dict: Full campaign details including status, lead count, and settings.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"campaign_id": campaign_id}

    if not validate_campaign_id(campaign_id):
        raise ToolError("Invalid campaign ID format")

    try:
        client = get_heyreach_client()
        result = await client.get(
            f"/campaigns/{campaign_id}", correlation_id=correlation_id
        )
        log_tool_result("get_campaign", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("get_campaign", params, e, start_time, correlation_id)
        _handle_api_error(e, "Get campaign")


@mcp.tool()
async def resume_campaign(campaign_id: str) -> dict[str, Any]:
    """Resume a paused campaign to start sending messages again.

    Args:
        campaign_id: The unique identifier of the campaign to resume.

    Returns:
        dict: Updated campaign status confirmation.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"campaign_id": campaign_id}

    if not validate_campaign_id(campaign_id):
        raise ToolError("Invalid campaign ID format")

    try:
        client = get_heyreach_client()
        result = await client.post(
            f"/campaigns/{campaign_id}/resume", correlation_id=correlation_id
        )
        log_tool_result("resume_campaign", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("resume_campaign", params, e, start_time, correlation_id)
        _handle_api_error(e, "Resume campaign")


@mcp.tool()
async def pause_campaign(campaign_id: str) -> dict[str, Any]:
    """Pause an active campaign to stop sending messages.

    Args:
        campaign_id: The unique identifier of the campaign to pause.

    Returns:
        dict: Updated campaign status confirmation.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"campaign_id": campaign_id}

    if not validate_campaign_id(campaign_id):
        raise ToolError("Invalid campaign ID format")

    try:
        client = get_heyreach_client()
        result = await client.post(
            f"/campaigns/{campaign_id}/pause", correlation_id=correlation_id
        )
        log_tool_result("pause_campaign", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("pause_campaign", params, e, start_time, correlation_id)
        _handle_api_error(e, "Pause campaign")


@mcp.tool()
async def add_leads_to_campaign(
    campaign_id: str,
    leads: list[dict[str, Any]],
) -> dict[str, Any]:
    """Add leads to a campaign for outreach.

    Args:
        campaign_id: The unique identifier of the campaign.
        leads: List of lead objects with linkedin_url and optional metadata
               (first_name, last_name, company, title, email, tags).
               Maximum 100 leads per request.

    Returns:
        dict: Result with success/failure counts and any errors.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"campaign_id": campaign_id, "lead_count": len(leads)}

    if not validate_campaign_id(campaign_id):
        raise ToolError("Invalid campaign ID format")

    if not leads:
        raise ToolError("At least one lead is required")

    if len(leads) > 100:
        raise ToolError("Maximum 100 leads per request. Split into multiple requests.")

    # Validate leads using Pydantic model
    try:
        validated_leads = BulkLeadInput(leads=[LeadInput(**lead) for lead in leads])
    except Exception as e:
        raise ToolError(f"Invalid lead data: {e}") from e

    try:
        client = get_heyreach_client()
        result = await client.post(
            f"/campaigns/{campaign_id}/leads",
            correlation_id=correlation_id,
            json={"leads": [lead.model_dump(exclude_none=True) for lead in validated_leads.leads]},
        )
        log_tool_result("add_leads_to_campaign", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("add_leads_to_campaign", params, e, start_time, correlation_id)
        _handle_api_error(e, "Add leads to campaign")


@mcp.tool()
async def stop_lead_in_campaign(
    campaign_id: str,
    lead_id: str,
) -> dict[str, Any]:
    """Stop the sequence for a specific lead in a campaign.

    Args:
        campaign_id: The unique identifier of the campaign.
        lead_id: The unique identifier of the lead.

    Returns:
        dict: Confirmation of lead sequence stop.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"campaign_id": campaign_id, "lead_id": lead_id}

    if not validate_campaign_id(campaign_id):
        raise ToolError("Invalid campaign ID format")

    if not validate_lead_id(lead_id):
        raise ToolError("Invalid lead ID format")

    try:
        client = get_heyreach_client()
        result = await client.post(
            f"/campaigns/{campaign_id}/leads/{lead_id}/stop",
            correlation_id=correlation_id,
        )
        log_tool_result("stop_lead_in_campaign", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("stop_lead_in_campaign", params, e, start_time, correlation_id)
        _handle_api_error(e, "Stop lead in campaign")


@mcp.tool()
async def get_campaign_leads(
    campaign_id: str,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict[str, Any]:
    """Get all leads in a campaign with optional status filtering.

    Args:
        campaign_id: The unique identifier of the campaign.
        status: Filter by lead status (NEW, CONTACTED, CONNECTED, REPLIED, etc.).
        limit: Maximum number of leads to return (default 100).
        offset: Number of leads to skip for pagination.

    Returns:
        dict: List of leads in the campaign with status and activity info.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params: dict[str, Any] = {
        "campaign_id": campaign_id,
        "limit": limit,
        "offset": offset,
    }

    if not validate_campaign_id(campaign_id):
        raise ToolError("Invalid campaign ID format")

    if status:
        if not LeadStatus.validate(status):
            raise ToolError(
                f"Invalid status '{status}'. Valid values: {LeadStatus.values()}"
            )
        params["status"] = status.upper()

    try:
        client = get_heyreach_client()
        query_params: dict[str, Any] = {"limit": limit, "offset": offset}
        if status:
            query_params["status"] = status.upper()

        result = await client.get(
            f"/campaigns/{campaign_id}/leads",
            correlation_id=correlation_id,
            params=query_params,
        )
        log_tool_result("get_campaign_leads", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("get_campaign_leads", params, e, start_time, correlation_id)
        _handle_api_error(e, "Get campaign leads")


# =============================================================================
# Inbox/Messages Tools (6 tools)
# =============================================================================


@mcp.tool()
async def get_conversations(
    limit: int = 50,
    offset: int = 0,
    unread_only: bool = False,
) -> dict[str, Any]:
    """List LinkedIn conversations/inbox messages.

    Args:
        limit: Maximum number of conversations to return (default 50).
        offset: Number of conversations to skip for pagination.
        unread_only: If True, only return unread conversations.

    Returns:
        dict: List of conversations with lead info and last message preview.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params: dict[str, Any] = {
        "limit": limit,
        "offset": offset,
        "unread_only": unread_only,
    }

    try:
        client = get_heyreach_client()
        query_params: dict[str, Any] = {"limit": limit, "offset": offset}
        if unread_only:
            query_params["unread"] = True

        result = await client.get(
            "/conversations", correlation_id=correlation_id, params=query_params
        )
        log_tool_result("get_conversations", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("get_conversations", params, e, start_time, correlation_id)
        _handle_api_error(e, "Get conversations")


@mcp.tool()
async def get_conversation(conversation_id: str) -> dict[str, Any]:
    """Get full conversation details including all messages.

    Args:
        conversation_id: The unique identifier of the conversation.

    Returns:
        dict: Full conversation with all messages in chronological order.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"conversation_id": conversation_id}

    if not conversation_id or len(conversation_id.strip()) < 5:
        raise ToolError("Invalid conversation ID format")

    try:
        client = get_heyreach_client()
        result = await client.get(
            f"/conversations/{conversation_id}", correlation_id=correlation_id
        )
        log_tool_result("get_conversation", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("get_conversation", params, e, start_time, correlation_id)
        _handle_api_error(e, "Get conversation")


@mcp.tool()
async def send_message(
    conversation_id: str,
    content: str,
) -> dict[str, Any]:
    """Send a LinkedIn message in an existing conversation.

    Args:
        conversation_id: The unique identifier of the conversation.
        content: The message content to send (max 8000 characters).

    Returns:
        dict: Confirmation of message sent with message ID.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"conversation_id": conversation_id, "content_length": len(content)}

    if not conversation_id or len(conversation_id.strip()) < 5:
        raise ToolError("Invalid conversation ID format")

    if not validate_message_content(content):
        raise ToolError("Message content must be 1-8000 characters")

    # Validate using Pydantic model
    try:
        validated = MessageInput(conversation_id=conversation_id, content=content)
    except Exception as e:
        raise ToolError(f"Invalid message data: {e}") from e

    try:
        client = get_heyreach_client()
        result = await client.post(
            f"/conversations/{conversation_id}/messages",
            correlation_id=correlation_id,
            json={"content": validated.content},
        )
        log_tool_result("send_message", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("send_message", params, e, start_time, correlation_id)
        _handle_api_error(e, "Send message")


@mcp.tool()
async def get_inbox_stats() -> dict[str, Any]:
    """Get inbox statistics including unread count and message metrics.

    Returns:
        dict: Inbox stats with unread count, total conversations, etc.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params: dict[str, Any] = {}

    try:
        client = get_heyreach_client()
        result = await client.get("/inbox/stats", correlation_id=correlation_id)
        log_tool_result("get_inbox_stats", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("get_inbox_stats", params, e, start_time, correlation_id)
        _handle_api_error(e, "Get inbox stats")


@mcp.tool()
async def mark_conversation_read(conversation_id: str) -> dict[str, Any]:
    """Mark a conversation as read.

    Args:
        conversation_id: The unique identifier of the conversation.

    Returns:
        dict: Confirmation of read status update.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"conversation_id": conversation_id}

    if not conversation_id or len(conversation_id.strip()) < 5:
        raise ToolError("Invalid conversation ID format")

    try:
        client = get_heyreach_client()
        result = await client.post(
            f"/conversations/{conversation_id}/read", correlation_id=correlation_id
        )
        log_tool_result("mark_conversation_read", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("mark_conversation_read", params, e, start_time, correlation_id)
        _handle_api_error(e, "Mark conversation read")


@mcp.tool()
async def archive_conversation(conversation_id: str) -> dict[str, Any]:
    """Archive a conversation to remove it from the active inbox.

    Args:
        conversation_id: The unique identifier of the conversation.

    Returns:
        dict: Confirmation of archive action.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"conversation_id": conversation_id}

    if not conversation_id or len(conversation_id.strip()) < 5:
        raise ToolError("Invalid conversation ID format")

    try:
        client = get_heyreach_client()
        result = await client.post(
            f"/conversations/{conversation_id}/archive", correlation_id=correlation_id
        )
        log_tool_result("archive_conversation", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("archive_conversation", params, e, start_time, correlation_id)
        _handle_api_error(e, "Archive conversation")


# =============================================================================
# LinkedIn Account Tools (4 tools)
# =============================================================================


@mcp.tool()
async def list_sender_accounts() -> dict[str, Any]:
    """List all connected LinkedIn sender accounts.

    Returns:
        dict: List of LinkedIn accounts with status, limits, and health info.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params: dict[str, Any] = {}

    try:
        client = get_heyreach_client()
        result = await client.get("/linkedin-accounts", correlation_id=correlation_id)
        log_tool_result("list_sender_accounts", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("list_sender_accounts", params, e, start_time, correlation_id)
        _handle_api_error(e, "List sender accounts")


@mcp.tool()
async def get_sender_account(account_id: str) -> dict[str, Any]:
    """Get detailed information about a specific LinkedIn account.

    Args:
        account_id: The unique identifier of the LinkedIn account.

    Returns:
        dict: Full account details including status, limits, and activity.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"account_id": account_id}

    if not account_id or len(account_id.strip()) < 5:
        raise ToolError("Invalid account ID format")

    try:
        client = get_heyreach_client()
        result = await client.get(
            f"/linkedin-accounts/{account_id}", correlation_id=correlation_id
        )
        log_tool_result("get_sender_account", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("get_sender_account", params, e, start_time, correlation_id)
        _handle_api_error(e, "Get sender account")


@mcp.tool()
async def get_account_limits(account_id: str) -> dict[str, Any]:
    """Get daily limits and current usage for a LinkedIn account.

    Args:
        account_id: The unique identifier of the LinkedIn account.

    Returns:
        dict: Daily limits for connections, messages, and current counts.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"account_id": account_id}

    if not account_id or len(account_id.strip()) < 5:
        raise ToolError("Invalid account ID format")

    try:
        client = get_heyreach_client()
        result = await client.get(
            f"/linkedin-accounts/{account_id}/limits", correlation_id=correlation_id
        )
        log_tool_result("get_account_limits", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("get_account_limits", params, e, start_time, correlation_id)
        _handle_api_error(e, "Get account limits")


@mcp.tool()
async def get_account_health(account_id: str) -> dict[str, Any]:
    """Get health status and metrics for a LinkedIn account.

    Args:
        account_id: The unique identifier of the LinkedIn account.

    Returns:
        dict: Account health score, warnings, and recommendations.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"account_id": account_id}

    if not account_id or len(account_id.strip()) < 5:
        raise ToolError("Invalid account ID format")

    try:
        client = get_heyreach_client()
        result = await client.get(
            f"/linkedin-accounts/{account_id}/health", correlation_id=correlation_id
        )
        log_tool_result("get_account_health", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("get_account_health", params, e, start_time, correlation_id)
        _handle_api_error(e, "Get account health")


# =============================================================================
# Lead List Tools (8 tools)
# =============================================================================


@mcp.tool()
async def list_lists(
    limit: int = 100,
    offset: int = 0,
) -> dict[str, Any]:
    """List all lead lists in the organization.

    Args:
        limit: Maximum number of lists to return (default 100).
        offset: Number of lists to skip for pagination.

    Returns:
        dict: List of lead lists with name, lead count, and metadata.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params: dict[str, Any] = {"limit": limit, "offset": offset}

    try:
        client = get_heyreach_client()
        result = await client.get(
            "/lists",
            correlation_id=correlation_id,
            params={"limit": limit, "offset": offset},
        )
        log_tool_result("list_lists", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("list_lists", params, e, start_time, correlation_id)
        _handle_api_error(e, "List lists")


@mcp.tool()
async def get_list(list_id: str) -> dict[str, Any]:
    """Get detailed information about a specific lead list.

    Args:
        list_id: The unique identifier of the lead list.

    Returns:
        dict: Full list details including lead count and metadata.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"list_id": list_id}

    if not list_id or len(list_id.strip()) < 5:
        raise ToolError("Invalid list ID format")

    try:
        client = get_heyreach_client()
        result = await client.get(f"/lists/{list_id}", correlation_id=correlation_id)
        log_tool_result("get_list", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("get_list", params, e, start_time, correlation_id)
        _handle_api_error(e, "Get list")


@mcp.tool()
async def create_list(name: str) -> dict[str, Any]:
    """Create a new lead list.

    Args:
        name: The name for the new lead list.

    Returns:
        dict: Created list details with ID.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"name": name}

    if not name or len(name.strip()) < 1:
        raise ToolError("List name is required")

    if len(name) > 200:
        raise ToolError("List name must be 200 characters or less")

    try:
        client = get_heyreach_client()
        result = await client.post(
            "/lists",
            correlation_id=correlation_id,
            json={"name": name.strip()},
        )
        log_tool_result("create_list", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("create_list", params, e, start_time, correlation_id)
        _handle_api_error(e, "Create list")


@mcp.tool()
async def get_leads_from_list(
    list_id: str,
    limit: int = 100,
    offset: int = 0,
) -> dict[str, Any]:
    """Get all leads from a specific list.

    Args:
        list_id: The unique identifier of the lead list.
        limit: Maximum number of leads to return (default 100).
        offset: Number of leads to skip for pagination.

    Returns:
        dict: List of leads with their profile data.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params: dict[str, Any] = {"list_id": list_id, "limit": limit, "offset": offset}

    if not list_id or len(list_id.strip()) < 5:
        raise ToolError("Invalid list ID format")

    try:
        client = get_heyreach_client()
        result = await client.get(
            f"/lists/{list_id}/leads",
            correlation_id=correlation_id,
            params={"limit": limit, "offset": offset},
        )
        log_tool_result("get_leads_from_list", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("get_leads_from_list", params, e, start_time, correlation_id)
        _handle_api_error(e, "Get leads from list")


@mcp.tool()
async def add_lead_to_list(
    list_id: str,
    lead: dict[str, Any],
) -> dict[str, Any]:
    """Add a lead to a list.

    Args:
        list_id: The unique identifier of the lead list.
        lead: Lead object with linkedin_url and optional metadata
              (first_name, last_name, company, title, email, tags).

    Returns:
        dict: Added lead details with ID.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"list_id": list_id}

    if not list_id or len(list_id.strip()) < 5:
        raise ToolError("Invalid list ID format")

    # Validate lead using Pydantic model
    try:
        validated_lead = LeadInput(**lead)
    except Exception as e:
        raise ToolError(f"Invalid lead data: {e}") from e

    try:
        client = get_heyreach_client()
        result = await client.post(
            f"/lists/{list_id}/leads",
            correlation_id=correlation_id,
            json=validated_lead.model_dump(exclude_none=True),
        )
        log_tool_result("add_lead_to_list", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("add_lead_to_list", params, e, start_time, correlation_id)
        _handle_api_error(e, "Add lead to list")


@mcp.tool()
async def delete_lead_from_list(
    list_id: str,
    lead_id: str,
) -> dict[str, Any]:
    """Remove a lead from a list.

    Args:
        list_id: The unique identifier of the lead list.
        lead_id: The unique identifier of the lead to remove.

    Returns:
        dict: Confirmation of lead removal.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"list_id": list_id, "lead_id": lead_id}

    if not list_id or len(list_id.strip()) < 5:
        raise ToolError("Invalid list ID format")

    if not validate_lead_id(lead_id):
        raise ToolError("Invalid lead ID format")

    try:
        client = get_heyreach_client()
        result = await client.delete(
            f"/lists/{list_id}/leads/{lead_id}", correlation_id=correlation_id
        )
        log_tool_result("delete_lead_from_list", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("delete_lead_from_list", params, e, start_time, correlation_id)
        _handle_api_error(e, "Delete lead from list")


@mcp.tool()
async def get_companies_from_list(
    list_id: str,
    limit: int = 100,
    offset: int = 0,
) -> dict[str, Any]:
    """Get unique companies from leads in a list.

    Args:
        list_id: The unique identifier of the lead list.
        limit: Maximum number of companies to return (default 100).
        offset: Number of companies to skip for pagination.

    Returns:
        dict: List of unique companies with lead counts.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params: dict[str, Any] = {"list_id": list_id, "limit": limit, "offset": offset}

    if not list_id or len(list_id.strip()) < 5:
        raise ToolError("Invalid list ID format")

    try:
        client = get_heyreach_client()
        result = await client.get(
            f"/lists/{list_id}/companies",
            correlation_id=correlation_id,
            params={"limit": limit, "offset": offset},
        )
        log_tool_result("get_companies_from_list", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("get_companies_from_list", params, e, start_time, correlation_id)
        _handle_api_error(e, "Get companies from list")


@mcp.tool()
async def get_lists_for_lead(lead_id: str) -> dict[str, Any]:
    """Get all lists that contain a specific lead.

    Args:
        lead_id: The unique identifier of the lead.

    Returns:
        dict: List of lead lists containing this lead.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"lead_id": lead_id}

    if not validate_lead_id(lead_id):
        raise ToolError("Invalid lead ID format")

    try:
        client = get_heyreach_client()
        result = await client.get(
            f"/leads/{lead_id}/lists", correlation_id=correlation_id
        )
        log_tool_result("get_lists_for_lead", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("get_lists_for_lead", params, e, start_time, correlation_id)
        _handle_api_error(e, "Get lists for lead")


# =============================================================================
# Lead Tools (5 tools)
# =============================================================================


@mcp.tool()
async def get_lead_details(lead_id: str) -> dict[str, Any]:
    """Get full profile details for a specific lead.

    Args:
        lead_id: The unique identifier of the lead.

    Returns:
        dict: Full lead profile with LinkedIn data, status, and activity history.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"lead_id": lead_id}

    if not validate_lead_id(lead_id):
        raise ToolError("Invalid lead ID format")

    try:
        client = get_heyreach_client()
        result = await client.get(f"/leads/{lead_id}", correlation_id=correlation_id)
        log_tool_result("get_lead_details", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("get_lead_details", params, e, start_time, correlation_id)
        _handle_api_error(e, "Get lead details")


@mcp.tool()
async def update_lead(
    lead_id: str,
    updates: dict[str, Any],
) -> dict[str, Any]:
    """Update lead data.

    Args:
        lead_id: The unique identifier of the lead.
        updates: Dictionary of fields to update (first_name, last_name,
                 company, title, email, tags).

    Returns:
        dict: Updated lead details.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"lead_id": lead_id, "updates": list(updates.keys())}

    if not validate_lead_id(lead_id):
        raise ToolError("Invalid lead ID format")

    if not updates:
        raise ToolError("At least one field to update is required")

    # Validate allowed fields
    allowed_fields = {"first_name", "last_name", "company", "title", "email", "tags"}
    invalid_fields = set(updates.keys()) - allowed_fields
    if invalid_fields:
        raise ToolError(
            f"Invalid fields: {invalid_fields}. Allowed: {allowed_fields}"
        )

    try:
        client = get_heyreach_client()
        result = await client.patch(
            f"/leads/{lead_id}",
            correlation_id=correlation_id,
            json=updates,
        )
        log_tool_result("update_lead", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("update_lead", params, e, start_time, correlation_id)
        _handle_api_error(e, "Update lead")


@mcp.tool()
async def add_lead_tag(
    lead_id: str,
    tag: str,
) -> dict[str, Any]:
    """Add a tag to a lead.

    Args:
        lead_id: The unique identifier of the lead.
        tag: The tag to add (max 50 characters).

    Returns:
        dict: Updated lead with new tag.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"lead_id": lead_id, "tag": tag}

    if not validate_lead_id(lead_id):
        raise ToolError("Invalid lead ID format")

    if not tag or len(tag.strip()) < 1:
        raise ToolError("Tag is required")

    if len(tag) > 50:
        raise ToolError("Tag must be 50 characters or less")

    try:
        client = get_heyreach_client()
        result = await client.post(
            f"/leads/{lead_id}/tags",
            correlation_id=correlation_id,
            json={"tag": tag.strip()},
        )
        log_tool_result("add_lead_tag", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("add_lead_tag", params, e, start_time, correlation_id)
        _handle_api_error(e, "Add lead tag")


@mcp.tool()
async def remove_lead_tag(
    lead_id: str,
    tag: str,
) -> dict[str, Any]:
    """Remove a tag from a lead.

    Args:
        lead_id: The unique identifier of the lead.
        tag: The tag to remove.

    Returns:
        dict: Updated lead without the tag.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"lead_id": lead_id, "tag": tag}

    if not validate_lead_id(lead_id):
        raise ToolError("Invalid lead ID format")

    if not tag or len(tag.strip()) < 1:
        raise ToolError("Tag is required")

    try:
        client = get_heyreach_client()
        result = await client.delete(
            f"/leads/{lead_id}/tags/{tag.strip()}", correlation_id=correlation_id
        )
        log_tool_result("remove_lead_tag", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("remove_lead_tag", params, e, start_time, correlation_id)
        _handle_api_error(e, "Remove lead tag")


@mcp.tool()
async def get_lead_activity(
    lead_id: str,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """Get engagement history for a lead.

    Args:
        lead_id: The unique identifier of the lead.
        limit: Maximum number of activity items to return (default 50).
        offset: Number of items to skip for pagination.

    Returns:
        dict: Lead activity history with timestamps and event types.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params: dict[str, Any] = {"lead_id": lead_id, "limit": limit, "offset": offset}

    if not validate_lead_id(lead_id):
        raise ToolError("Invalid lead ID format")

    try:
        client = get_heyreach_client()
        result = await client.get(
            f"/leads/{lead_id}/activity",
            correlation_id=correlation_id,
            params={"limit": limit, "offset": offset},
        )
        log_tool_result("get_lead_activity", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("get_lead_activity", params, e, start_time, correlation_id)
        _handle_api_error(e, "Get lead activity")


# =============================================================================
# Stats/Analytics Tools (2 tools)
# =============================================================================


@mcp.tool()
async def get_overall_stats(
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict[str, Any]:
    """Get organization-wide statistics.

    Args:
        start_date: Start date for stats (ISO format: YYYY-MM-DD).
        end_date: End date for stats (ISO format: YYYY-MM-DD).

    Returns:
        dict: Overall stats including connections, messages, replies, etc.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params: dict[str, Any] = {}

    query_params: dict[str, Any] = {}
    if start_date:
        params["start_date"] = start_date
        query_params["start_date"] = start_date
    if end_date:
        params["end_date"] = end_date
        query_params["end_date"] = end_date

    try:
        client = get_heyreach_client()
        result = await client.get(
            "/stats/overall",
            correlation_id=correlation_id,
            params=query_params if query_params else None,
        )
        log_tool_result("get_overall_stats", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("get_overall_stats", params, e, start_time, correlation_id)
        _handle_api_error(e, "Get overall stats")


@mcp.tool()
async def get_campaign_stats(
    campaign_id: str,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict[str, Any]:
    """Get performance statistics for a specific campaign.

    Args:
        campaign_id: The unique identifier of the campaign.
        start_date: Start date for stats (ISO format: YYYY-MM-DD).
        end_date: End date for stats (ISO format: YYYY-MM-DD).

    Returns:
        dict: Campaign stats including connections, messages, replies, rates.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params: dict[str, Any] = {"campaign_id": campaign_id}

    if not validate_campaign_id(campaign_id):
        raise ToolError("Invalid campaign ID format")

    query_params: dict[str, Any] = {}
    if start_date:
        params["start_date"] = start_date
        query_params["start_date"] = start_date
    if end_date:
        params["end_date"] = end_date
        query_params["end_date"] = end_date

    try:
        client = get_heyreach_client()
        result = await client.get(
            f"/campaigns/{campaign_id}/stats",
            correlation_id=correlation_id,
            params=query_params if query_params else None,
        )
        log_tool_result("get_campaign_stats", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("get_campaign_stats", params, e, start_time, correlation_id)
        _handle_api_error(e, "Get campaign stats")


# =============================================================================
# Webhook Tools (2 tools)
# =============================================================================


@mcp.tool()
async def list_webhooks() -> dict[str, Any]:
    """List all configured webhooks.

    Returns:
        dict: List of webhooks with URLs and subscribed events.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params: dict[str, Any] = {}

    try:
        client = get_heyreach_client()
        result = await client.get("/webhooks", correlation_id=correlation_id)
        log_tool_result("list_webhooks", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("list_webhooks", params, e, start_time, correlation_id)
        _handle_api_error(e, "List webhooks")


@mcp.tool()
async def create_webhook(
    url: str,
    events: list[str],
) -> dict[str, Any]:
    """Create a webhook subscription.

    Args:
        url: The callback URL for webhook events.
        events: List of event types to subscribe to. Valid types:
                lead.replied, lead.connected, lead.viewed_profile,
                campaign.completed, account.disconnected.

    Returns:
        dict: Created webhook details with ID.
    """
    start_time = time.perf_counter()
    correlation_id = generate_correlation_id()
    params = {"url": url, "events": events}

    if not url or not url.startswith(("http://", "https://")):
        raise ToolError("Valid webhook URL is required (must start with http:// or https://)")

    if not events:
        raise ToolError("At least one event type is required")

    # Validate events using Pydantic model
    try:
        validated = WebhookInput(url=url, events=events)
    except Exception as e:
        raise ToolError(f"Invalid webhook data: {e}") from e

    try:
        client = get_heyreach_client()
        result = await client.post(
            "/webhooks",
            correlation_id=correlation_id,
            json={"url": validated.url, "events": validated.events},
        )
        log_tool_result("create_webhook", params, result, start_time, correlation_id)
        return result
    except HeyReachAPIError as e:
        log_tool_error("create_webhook", params, e, start_time, correlation_id)
        _handle_api_error(e, "Create webhook")


# =============================================================================
# Module Exports
# =============================================================================

__all__ = [
    "mcp",
    # Authentication
    "check_api_key",
    # Campaigns
    "list_campaigns",
    "get_campaign",
    "resume_campaign",
    "pause_campaign",
    "add_leads_to_campaign",
    "stop_lead_in_campaign",
    "get_campaign_leads",
    # Inbox/Messages
    "get_conversations",
    "get_conversation",
    "send_message",
    "get_inbox_stats",
    "mark_conversation_read",
    "archive_conversation",
    # LinkedIn Accounts
    "list_sender_accounts",
    "get_sender_account",
    "get_account_limits",
    "get_account_health",
    # Lists
    "list_lists",
    "get_list",
    "create_list",
    "get_leads_from_list",
    "add_lead_to_list",
    "delete_lead_from_list",
    "get_companies_from_list",
    "get_lists_for_lead",
    # Leads
    "get_lead_details",
    "update_lead",
    "add_lead_tag",
    "remove_lead_tag",
    "get_lead_activity",
    # Stats/Analytics
    "get_overall_stats",
    "get_campaign_stats",
    # Webhooks
    "list_webhooks",
    "create_webhook",
]
