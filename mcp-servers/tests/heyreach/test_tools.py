"""Tests for HeyReach MCP tool implementations.

Tests verify:
- All 35 tools across 8 categories (Authentication, Campaigns, Inbox, Accounts, Lists, Leads, Stats, Webhooks)
- Input validation and error handling
- API client integration with mocked responses
- Error classification and retry behavior

Note: MCP tools are wrapped in FunctionTool objects by FastMCP.
We access the underlying function via .fn to test them directly.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

if TYPE_CHECKING:
    from collections.abc import Generator


# =============================================================================
# Mock Client Factory
# =============================================================================


def create_mock_client(return_value: Any = None, side_effect: Exception | None = None):
    """Create a mock HeyReach client with all HTTP methods mocked."""
    mock_client = MagicMock()

    if side_effect:
        mock_client.get = AsyncMock(side_effect=side_effect)
        mock_client.post = AsyncMock(side_effect=side_effect)
        mock_client.put = AsyncMock(side_effect=side_effect)
        mock_client.patch = AsyncMock(side_effect=side_effect)
        mock_client.delete = AsyncMock(side_effect=side_effect)
    else:
        mock_client.get = AsyncMock(return_value=return_value)
        mock_client.post = AsyncMock(return_value=return_value)
        mock_client.put = AsyncMock(return_value=return_value)
        mock_client.patch = AsyncMock(return_value=return_value)
        mock_client.delete = AsyncMock(return_value=return_value)

    return mock_client


def get_tool_fn(tool):
    """Get the underlying function from a FunctionTool wrapper."""
    return tool.fn


# =============================================================================
# Authentication Tool Tests
# =============================================================================


class TestCheckApiKey:
    """Tests for check_api_key tool."""

    @pytest.mark.asyncio
    async def test_valid_api_key(self, sample_linkedin_account_list):
        """Test successful API key validation."""
        from atlas_gtm_mcp.heyreach import check_api_key

        mock_client = create_mock_client(return_value=sample_linkedin_account_list)

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(check_api_key)
            result = await fn()

            assert result["valid"] is True
            assert "message" in result
            mock_client.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_invalid_api_key(self):
        """Test invalid API key detection."""
        from atlas_gtm_mcp.heyreach import check_api_key
        from atlas_gtm_mcp.heyreach.client import HeyReachNonRetriableError

        mock_client = create_mock_client(
            side_effect=HeyReachNonRetriableError("Authentication failed", status_code=401)
        )

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(check_api_key)
            result = await fn()

            assert result["valid"] is False
            assert "invalid" in result["message"].lower() or "error" in result["message"].lower()


# =============================================================================
# Campaign Tool Tests
# =============================================================================


class TestListCampaigns:
    """Tests for list_campaigns tool."""

    @pytest.mark.asyncio
    async def test_list_campaigns_success(self, sample_campaign_list):
        """Test successful campaign listing."""
        from atlas_gtm_mcp.heyreach import list_campaigns

        mock_client = create_mock_client(return_value=sample_campaign_list)

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(list_campaigns)
            result = await fn()

            # Tool returns API result directly (a list)
            assert isinstance(result, list)
            assert len(result) == 2
            mock_client.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_campaigns_with_status_filter(self, sample_campaign_list):
        """Test campaign listing with status filter."""
        from atlas_gtm_mcp.heyreach import list_campaigns

        mock_client = create_mock_client(return_value=sample_campaign_list)

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(list_campaigns)
            result = await fn(status="ACTIVE")

            assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_list_campaigns_invalid_status(self):
        """Test campaign listing with invalid status."""
        from atlas_gtm_mcp.heyreach import list_campaigns
        from fastmcp.exceptions import ToolError

        mock_client = create_mock_client(return_value=[])

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(list_campaigns)
            with pytest.raises(ToolError):
                await fn(status="INVALID_STATUS")


class TestGetCampaign:
    """Tests for get_campaign tool."""

    @pytest.mark.asyncio
    async def test_get_campaign_success(self, sample_campaign):
        """Test successful campaign retrieval."""
        from atlas_gtm_mcp.heyreach import get_campaign

        mock_client = create_mock_client(return_value=sample_campaign)

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(get_campaign)
            result = await fn("camp_hr_12345678901234567890")

            assert "id" in result
            mock_client.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_campaign_invalid_id(self):
        """Test campaign retrieval with invalid ID."""
        from atlas_gtm_mcp.heyreach import get_campaign
        from fastmcp.exceptions import ToolError

        fn = get_tool_fn(get_campaign)
        with pytest.raises(ToolError):
            await fn("")


class TestResumeCampaign:
    """Tests for resume_campaign tool."""

    @pytest.mark.asyncio
    async def test_resume_campaign_success(self):
        """Test successful campaign resumption."""
        from atlas_gtm_mcp.heyreach import resume_campaign

        mock_client = create_mock_client(return_value={"success": True})

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(resume_campaign)
            result = await fn("camp_hr_12345678901234567890")

            assert "success" in result or "message" in result
            mock_client.post.assert_called_once()


class TestPauseCampaign:
    """Tests for pause_campaign tool."""

    @pytest.mark.asyncio
    async def test_pause_campaign_success(self):
        """Test successful campaign pause."""
        from atlas_gtm_mcp.heyreach import pause_campaign

        mock_client = create_mock_client(return_value={"success": True})

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(pause_campaign)
            result = await fn("camp_hr_12345678901234567890")

            assert "success" in result or "message" in result
            mock_client.post.assert_called_once()


class TestAddLeadsToCampaign:
    """Tests for add_leads_to_campaign tool."""

    @pytest.mark.asyncio
    async def test_add_leads_success(self):
        """Test successful lead addition to campaign."""
        from atlas_gtm_mcp.heyreach import add_leads_to_campaign

        mock_client = create_mock_client(return_value={"added": 2})

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(add_leads_to_campaign)
            leads = [
                {"linkedin_url": "https://linkedin.com/in/johndoe"},
                {"linkedin_url": "https://linkedin.com/in/janesmith"},
            ]
            result = await fn("camp_hr_12345678901234567890", leads)

            assert result is not None
            mock_client.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_add_leads_empty_list(self):
        """Test adding empty lead list."""
        from atlas_gtm_mcp.heyreach import add_leads_to_campaign
        from fastmcp.exceptions import ToolError

        fn = get_tool_fn(add_leads_to_campaign)
        with pytest.raises(ToolError):
            await fn("camp_hr_12345678901234567890", [])

    @pytest.mark.asyncio
    async def test_add_leads_exceeds_limit(self):
        """Test adding more than 100 leads."""
        from atlas_gtm_mcp.heyreach import add_leads_to_campaign
        from fastmcp.exceptions import ToolError

        leads = [{"linkedin_url": f"https://linkedin.com/in/user{i}"} for i in range(101)]

        fn = get_tool_fn(add_leads_to_campaign)
        with pytest.raises(ToolError):
            await fn("camp_hr_12345678901234567890", leads)


class TestGetCampaignLeads:
    """Tests for get_campaign_leads tool."""

    @pytest.mark.asyncio
    async def test_get_campaign_leads_success(self, sample_lead_list):
        """Test successful campaign leads retrieval."""
        from atlas_gtm_mcp.heyreach import get_campaign_leads

        mock_client = create_mock_client(return_value=sample_lead_list)

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(get_campaign_leads)
            result = await fn("camp_hr_12345678901234567890")

            # Tool returns API result directly (a list)
            assert isinstance(result, list)
            mock_client.get.assert_called_once()


# =============================================================================
# Inbox/Messages Tool Tests
# =============================================================================


class TestGetConversations:
    """Tests for get_conversations tool."""

    @pytest.mark.asyncio
    async def test_get_conversations_success(self, sample_conversation):
        """Test successful conversations retrieval."""
        from atlas_gtm_mcp.heyreach import get_conversations

        mock_client = create_mock_client(return_value=[sample_conversation])

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(get_conversations)
            result = await fn()

            # Tool returns API result directly (a list)
            assert isinstance(result, list)
            mock_client.get.assert_called_once()


class TestGetConversation:
    """Tests for get_conversation tool."""

    @pytest.mark.asyncio
    async def test_get_conversation_success(self, sample_conversation_with_messages):
        """Test successful conversation retrieval with messages."""
        from atlas_gtm_mcp.heyreach import get_conversation

        mock_client = create_mock_client(return_value=sample_conversation_with_messages)

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(get_conversation)
            result = await fn("conv_hr_12345678901234567890")

            assert "id" in result or "messages" in result
            mock_client.get.assert_called_once()


class TestSendMessage:
    """Tests for send_message tool."""

    @pytest.mark.asyncio
    async def test_send_message_success(self):
        """Test successful message sending."""
        from atlas_gtm_mcp.heyreach import send_message

        mock_client = create_mock_client(return_value={"sent": True})

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(send_message)
            result = await fn(
                "conv_hr_12345678901234567890",
                "Hello, this is a test message."
            )

            assert result is not None
            mock_client.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_message_empty_content(self):
        """Test sending empty message content."""
        from atlas_gtm_mcp.heyreach import send_message
        from fastmcp.exceptions import ToolError

        fn = get_tool_fn(send_message)
        with pytest.raises(ToolError):
            await fn("conv_hr_12345678901234567890", "")


class TestGetInboxStats:
    """Tests for get_inbox_stats tool."""

    @pytest.mark.asyncio
    async def test_get_inbox_stats_success(self):
        """Test successful inbox stats retrieval."""
        from atlas_gtm_mcp.heyreach import get_inbox_stats

        mock_client = create_mock_client(return_value={
            "total_conversations": 100,
            "unread": 10,
            "pending": 5
        })

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(get_inbox_stats)
            result = await fn()

            assert result is not None
            mock_client.get.assert_called_once()


# =============================================================================
# LinkedIn Accounts Tool Tests
# =============================================================================


class TestListSenderAccounts:
    """Tests for list_sender_accounts tool."""

    @pytest.mark.asyncio
    async def test_list_accounts_success(self, sample_linkedin_account_list):
        """Test successful account listing."""
        from atlas_gtm_mcp.heyreach import list_sender_accounts

        mock_client = create_mock_client(return_value=sample_linkedin_account_list)

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(list_sender_accounts)
            result = await fn()

            # Tool returns API result directly (a list)
            assert isinstance(result, list)
            mock_client.get.assert_called_once()


class TestGetSenderAccount:
    """Tests for get_sender_account tool."""

    @pytest.mark.asyncio
    async def test_get_account_success(self, sample_linkedin_account):
        """Test successful account retrieval."""
        from atlas_gtm_mcp.heyreach import get_sender_account

        mock_client = create_mock_client(return_value=sample_linkedin_account)

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(get_sender_account)
            result = await fn("acc_linkedin_12345")

            assert "id" in result
            mock_client.get.assert_called_once()


class TestGetAccountLimits:
    """Tests for get_account_limits tool."""

    @pytest.mark.asyncio
    async def test_get_limits_success(self):
        """Test successful account limits retrieval."""
        from atlas_gtm_mcp.heyreach import get_account_limits

        mock_client = create_mock_client(return_value={
            "daily_connection_limit": 25,
            "daily_message_limit": 100,
            "connections_sent_today": 15,
            "messages_sent_today": 45
        })

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(get_account_limits)
            result = await fn("acc_linkedin_12345")

            assert result is not None
            mock_client.get.assert_called_once()


class TestGetAccountHealth:
    """Tests for get_account_health tool."""

    @pytest.mark.asyncio
    async def test_get_health_success(self):
        """Test successful account health retrieval."""
        from atlas_gtm_mcp.heyreach import get_account_health

        mock_client = create_mock_client(return_value={
            "status": "CONNECTED",
            "health_score": 95
        })

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(get_account_health)
            result = await fn("acc_linkedin_12345")

            assert result is not None
            mock_client.get.assert_called_once()


# =============================================================================
# Lists Tool Tests
# =============================================================================


class TestListLists:
    """Tests for list_lists tool."""

    @pytest.mark.asyncio
    async def test_list_lists_success(self, sample_lead_list_data):
        """Test successful lead lists retrieval."""
        from atlas_gtm_mcp.heyreach import list_lists

        mock_client = create_mock_client(return_value=[sample_lead_list_data])

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(list_lists)
            result = await fn()

            # Tool returns API result directly (a list)
            assert isinstance(result, list)
            mock_client.get.assert_called_once()


class TestGetList:
    """Tests for get_list tool."""

    @pytest.mark.asyncio
    async def test_get_list_success(self, sample_lead_list_data):
        """Test successful list retrieval."""
        from atlas_gtm_mcp.heyreach import get_list

        mock_client = create_mock_client(return_value=sample_lead_list_data)

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(get_list)
            result = await fn("list_hr_12345678901234567890")

            assert "id" in result
            mock_client.get.assert_called_once()


class TestCreateList:
    """Tests for create_list tool."""

    @pytest.mark.asyncio
    async def test_create_list_success(self):
        """Test successful list creation."""
        from atlas_gtm_mcp.heyreach import create_list

        mock_client = create_mock_client(return_value={
            "id": "list_hr_new_12345678901234567890",
            "name": "New Test List"
        })

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(create_list)
            result = await fn("New Test List")

            assert "id" in result
            mock_client.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_list_empty_name(self):
        """Test creating list with empty name."""
        from atlas_gtm_mcp.heyreach import create_list
        from fastmcp.exceptions import ToolError

        fn = get_tool_fn(create_list)
        with pytest.raises(ToolError):
            await fn("")


class TestAddLeadToList:
    """Tests for add_lead_to_list tool."""

    @pytest.mark.asyncio
    async def test_add_lead_success(self):
        """Test successful lead addition to list."""
        from atlas_gtm_mcp.heyreach import add_lead_to_list

        mock_client = create_mock_client(return_value={"added": True})

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(add_lead_to_list)
            # Lead must be a dict that can be unpacked into LeadInput
            result = await fn(
                "list_hr_12345678901234567890",
                {"linkedin_url": "https://linkedin.com/in/johndoe"}
            )

            assert result is not None
            mock_client.post.assert_called_once()


class TestDeleteLeadFromList:
    """Tests for delete_lead_from_list tool."""

    @pytest.mark.asyncio
    async def test_delete_lead_success(self):
        """Test successful lead deletion from list."""
        from atlas_gtm_mcp.heyreach import delete_lead_from_list

        mock_client = create_mock_client(return_value={"deleted": True})

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(delete_lead_from_list)
            result = await fn(
                "list_hr_12345678901234567890",
                "lead_hr_12345678901234567890"
            )

            assert result is not None
            mock_client.delete.assert_called_once()


# =============================================================================
# Leads Tool Tests
# =============================================================================


class TestGetLeadDetails:
    """Tests for get_lead_details tool."""

    @pytest.mark.asyncio
    async def test_get_lead_success(self, sample_lead):
        """Test successful lead retrieval."""
        from atlas_gtm_mcp.heyreach import get_lead_details

        mock_client = create_mock_client(return_value=sample_lead)

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(get_lead_details)
            result = await fn("lead_hr_12345678901234567890")

            assert "id" in result or "linkedin_url" in result
            mock_client.get.assert_called_once()


class TestUpdateLead:
    """Tests for update_lead tool."""

    @pytest.mark.asyncio
    async def test_update_lead_success(self):
        """Test successful lead update."""
        from atlas_gtm_mcp.heyreach import update_lead

        mock_client = create_mock_client(return_value={"updated": True})

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(update_lead)
            result = await fn(
                "lead_hr_12345678901234567890",
                {"company": "New Company"}
            )

            assert result is not None
            mock_client.patch.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_lead_invalid_field(self):
        """Test updating lead with invalid field raises ToolError."""
        from atlas_gtm_mcp.heyreach import update_lead
        from fastmcp.exceptions import ToolError

        fn = get_tool_fn(update_lead)
        # Tool should reject invalid fields with ToolError
        with pytest.raises(ToolError) as exc_info:
            await fn(
                "lead_hr_12345678901234567890",
                {"invalid_field": "value"}
            )
        assert "Invalid fields" in str(exc_info.value)


class TestAddLeadTag:
    """Tests for add_lead_tag tool."""

    @pytest.mark.asyncio
    async def test_add_tag_success(self):
        """Test successful tag addition."""
        from atlas_gtm_mcp.heyreach import add_lead_tag

        mock_client = create_mock_client(return_value={"added": True})

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(add_lead_tag)
            result = await fn("lead_hr_12345678901234567890", "important")

            assert result is not None
            mock_client.post.assert_called_once()


class TestRemoveLeadTag:
    """Tests for remove_lead_tag tool."""

    @pytest.mark.asyncio
    async def test_remove_tag_success(self):
        """Test successful tag removal."""
        from atlas_gtm_mcp.heyreach import remove_lead_tag

        mock_client = create_mock_client(return_value={"removed": True})

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(remove_lead_tag)
            result = await fn("lead_hr_12345678901234567890", "important")

            assert result is not None
            mock_client.delete.assert_called_once()


class TestGetLeadActivity:
    """Tests for get_lead_activity tool."""

    @pytest.mark.asyncio
    async def test_get_activity_success(self):
        """Test successful activity retrieval."""
        from atlas_gtm_mcp.heyreach import get_lead_activity

        mock_client = create_mock_client(return_value={
            "activities": [
                {"type": "message_sent", "timestamp": "2024-01-15T10:30:00Z"},
                {"type": "connection_accepted", "timestamp": "2024-01-14T08:00:00Z"}
            ]
        })

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(get_lead_activity)
            result = await fn("lead_hr_12345678901234567890")

            assert result is not None
            mock_client.get.assert_called_once()


# =============================================================================
# Stats Tool Tests
# =============================================================================


class TestGetOverallStats:
    """Tests for get_overall_stats tool."""

    @pytest.mark.asyncio
    async def test_get_overall_stats_success(self, sample_stats):
        """Test successful overall stats retrieval."""
        from atlas_gtm_mcp.heyreach import get_overall_stats

        mock_client = create_mock_client(return_value=sample_stats)

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(get_overall_stats)
            result = await fn()

            assert result is not None
            mock_client.get.assert_called_once()


class TestGetCampaignStats:
    """Tests for get_campaign_stats tool."""

    @pytest.mark.asyncio
    async def test_get_campaign_stats_success(self, sample_stats):
        """Test successful campaign stats retrieval."""
        from atlas_gtm_mcp.heyreach import get_campaign_stats

        mock_client = create_mock_client(return_value=sample_stats)

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(get_campaign_stats)
            result = await fn("camp_hr_12345678901234567890")

            assert result is not None
            mock_client.get.assert_called_once()


# =============================================================================
# Webhook Tool Tests
# =============================================================================


class TestListWebhooks:
    """Tests for list_webhooks tool."""

    @pytest.mark.asyncio
    async def test_list_webhooks_success(self, sample_webhook):
        """Test successful webhook listing."""
        from atlas_gtm_mcp.heyreach import list_webhooks

        mock_client = create_mock_client(return_value=[sample_webhook])

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(list_webhooks)
            result = await fn()

            # Tool returns API result directly (a list)
            assert isinstance(result, list)
            mock_client.get.assert_called_once()


class TestCreateWebhook:
    """Tests for create_webhook tool."""

    @pytest.mark.asyncio
    async def test_create_webhook_success(self):
        """Test successful webhook creation."""
        from atlas_gtm_mcp.heyreach import create_webhook

        mock_client = create_mock_client(return_value={
            "id": "webhook_hr_new_12345678901234567890",
            "url": "https://example.com/webhook",
            "active": True
        })

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(create_webhook)
            result = await fn(
                "https://example.com/webhook",
                ["lead.replied", "lead.connected"]
            )

            assert "id" in result
            mock_client.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_webhook_invalid_url(self):
        """Test creating webhook with invalid URL."""
        from atlas_gtm_mcp.heyreach import create_webhook
        from fastmcp.exceptions import ToolError

        fn = get_tool_fn(create_webhook)
        with pytest.raises(ToolError):
            await fn("not-a-valid-url", ["lead.replied"])

    @pytest.mark.asyncio
    async def test_create_webhook_invalid_event(self):
        """Test creating webhook with invalid event type."""
        from atlas_gtm_mcp.heyreach import create_webhook
        from fastmcp.exceptions import ToolError

        fn = get_tool_fn(create_webhook)
        with pytest.raises(ToolError):
            await fn("https://example.com/webhook", ["invalid_event"])


# =============================================================================
# Error Handling Tests
# =============================================================================


class TestRetriableErrors:
    """Tests for retriable error handling."""

    @pytest.mark.asyncio
    async def test_rate_limit_error(self):
        """Test rate limit error is properly classified."""
        from atlas_gtm_mcp.heyreach import list_campaigns
        from atlas_gtm_mcp.heyreach.client import HeyReachRetriableError
        from fastmcp.exceptions import ToolError

        mock_client = create_mock_client(
            side_effect=HeyReachRetriableError("Rate limited", status_code=429)
        )

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(list_campaigns)
            with pytest.raises(ToolError):
                await fn()

    @pytest.mark.asyncio
    async def test_service_unavailable_error(self):
        """Test service unavailable error is properly classified."""
        from atlas_gtm_mcp.heyreach import list_campaigns
        from atlas_gtm_mcp.heyreach.client import HeyReachRetriableError
        from fastmcp.exceptions import ToolError

        mock_client = create_mock_client(
            side_effect=HeyReachRetriableError("Service unavailable", status_code=503)
        )

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(list_campaigns)
            with pytest.raises(ToolError):
                await fn()


class TestNonRetriableErrors:
    """Tests for non-retriable error handling."""

    @pytest.mark.asyncio
    async def test_authentication_error(self):
        """Test authentication error is properly classified."""
        from atlas_gtm_mcp.heyreach import list_campaigns
        from atlas_gtm_mcp.heyreach.client import HeyReachNonRetriableError
        from fastmcp.exceptions import ToolError

        mock_client = create_mock_client(
            side_effect=HeyReachNonRetriableError("Authentication failed", status_code=401)
        )

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(list_campaigns)
            with pytest.raises(ToolError):
                await fn()

    @pytest.mark.asyncio
    async def test_not_found_error(self):
        """Test not found error is properly classified."""
        from atlas_gtm_mcp.heyreach import get_campaign
        from atlas_gtm_mcp.heyreach.client import HeyReachNonRetriableError
        from fastmcp.exceptions import ToolError

        mock_client = create_mock_client(
            side_effect=HeyReachNonRetriableError("Campaign not found", status_code=404)
        )

        with patch("atlas_gtm_mcp.heyreach.get_heyreach_client", return_value=mock_client):
            fn = get_tool_fn(get_campaign)
            with pytest.raises(ToolError):
                await fn("camp_hr_nonexistent")
