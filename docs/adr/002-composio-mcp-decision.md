# ADR-002: Custom MCP Servers over Composio

**Status**: Accepted
**Date**: 2026-01-20
**Decision Makers**: Engineering Team
**Technical Story**: MCP architecture for external integrations (Slack, Airtable, etc.)

---

## Context

The original Atlas GTM architecture planned to use **Composio** for managed MCP servers:

| Planned Composio MCPs | Purpose |
|----------------------|---------|
| Airtable MCP | Lead database CRUD |
| Slack MCP | Notifications, approvals |
| Google Calendar MCP | Meeting triggers |
| Gmail MCP | Email context |

This was documented in `ARCHITECTURE.md` and `specs/mcp-servers.md` as the "COMPOSIO MANAGED" tier.

During the Reply Handler agent implementation (branch `006-reply-handler-agent`), research explicitly **rejected Composio** in favor of a custom approach. The research findings in `specs/006-reply-handler-agent/research.md` stated:

> **Composio**: REJECTED
> - Adds unnecessary abstraction layer
> - Project follows "direct API client" pattern
> - No additional value over native SDKs

---

## Decision

**Use custom Python FastMCP servers + direct SDK hybrid** for all external integrations instead of Composio.

**Architecture**:
```
CUSTOM BUILD (VPS - Python FastMCP):
├─ qdrant-mcp ────── KB queries
├─ attio-mcp ─────── CRM operations
├─ instantly-mcp ─── Email campaigns
├─ slack-mcp ─────── Notifications, approvals
└─ linkedin-mcp ──── LinkedIn automation (Aimfox)

DIRECT SDK (TypeScript Agent):
└─ @slack/web-api ── Modal operations (trigger_id timing constraint)

n8n INTEGRATIONS (via n8n nodes):
├─ Airtable ──────── Lead database CRUD
├─ Google Calendar ─ Meeting triggers
└─ Gmail ─────────── Email context (if needed)
```

---

## Rationale

### 1. Performance-Critical Operations

The Reply Handler has a **3-second constraint** for Slack modal operations (`trigger_id` expiry). Composio's additional abstraction layer introduces latency that cannot be tolerated.

### 2. Existing Infrastructure

Atlas GTM already runs on a VPS with:
- n8n (workflow automation)
- Qdrant (vector database)
- PostgreSQL (n8n metadata)
- Custom MCP servers (Qdrant, Attio, Instantly)

Adding Composio introduces external dependency for infrastructure we can self-host.

### 3. Limited Integration Scope

Atlas GTM needs only 4-5 integrations:
- Attio CRM
- Instantly email
- Qdrant KB
- LinkedIn (via Aimfox)
- Slack

For this limited scope, Composio's 500+ pre-built MCPs provide no value—we'd use less than 1%.

### 4. Full Control Requirements

GTM agents require:
- **Brain-scoped queries**: All Qdrant queries MUST include `brain_id` filter
- **KV-cache optimization**: Precise control over token flow
- **Custom error handling**: GTM-specific retry semantics
- **Structured logging**: Observability with Langfuse integration

Composio's abstractions would obscure these patterns.

### 5. Cost at Scale

Self-hosted MCP servers have:
- Fixed VPS cost (~$50/month total)
- No per-request charges
- No vendor lock-in

Composio charges based on usage, which could exceed self-hosted costs at production volume.

---

## Alternatives Considered

### Composio (Managed MCPs)

**Pros**:
- Pre-built MCP servers for 500+ apps
- Managed OAuth flows and token refresh
- Zero DevOps for integrations
- Tool Router for discovering capabilities
- White-label OAuth consent screens

**Cons**:
- Abstraction layer adds latency
- Less control over data flow
- External dependency
- Cost scales with usage
- Can't customize for brain-scoped patterns

**When Composio IS the right choice**:

| Use Case | Why Composio Helps |
|----------|-------------------|
| **Multi-User SaaS** | Per-user OAuth URLs, managed token refresh |
| **Rapid Prototyping** | 500+ pre-built servers, zero DevOps |
| **OAuth Complexity** | Consent screens, scopes, refresh handled |
| **Tool Discovery** | Tool Router searches across all 500+ tools |
| **Many Integrations** | Need 10+ different services quickly |
| **White-Labeling** | Custom OAuth consent screen branding |
| **Triggers/Webhooks** | Subscribe to external events |

### Direct API Calls (No MCP)

**Pros**:
- Simplest architecture
- No MCP overhead

**Cons**:
- No tool abstraction for Claude
- Inconsistent patterns across integrations
- Harder to test and mock

**Verdict**: Rejected. MCP provides valuable tool abstraction for Claude.

---

## Consequences

### Positive

1. **Full control** over data flow, error handling, and observability
2. **Performance** - no external abstraction layer latency
3. **Cost predictability** - fixed VPS cost regardless of usage
4. **Consistency** - all MCPs follow same FastMCP pattern
5. **Brain-scoped queries** - can enforce `brain_id` filter at MCP level
6. **Debugging** - stack traces point to our code

### Negative

1. **Manual OAuth handling** - must implement token refresh ourselves
2. **MCP maintenance** - responsible for updates and bug fixes
3. **Initial development time** - custom implementation vs pre-built
4. **No managed triggers** - must set up webhooks manually

### Mitigations

| Negative | Mitigation |
|----------|------------|
| Manual OAuth | Use official SDKs (`slack_sdk`, etc.) that handle tokens |
| MCP maintenance | FastMCP is lightweight, minimal maintenance |
| Development time | Existing patterns from Qdrant/Attio MCPs |
| No triggers | n8n webhook nodes for external events |

---

## When to Reconsider

Consider Composio for future projects if:

1. **Building multi-tenant SaaS** where each customer needs their own OAuth connections
2. **Need 10+ integrations** quickly without dedicated DevOps time
3. **OAuth complexity** becomes a burden (multiple providers, consent flows)
4. **DevOps capacity** is limited and managed infrastructure is preferred
5. **Prototype phase** where speed matters more than control

---

## Implementation Notes

### Slack Integration Pattern

Based on research findings:

```
Python FastMCP (mcp-servers/atlas_gtm_mcp/slack/):
├─ post_message()      # Non-time-critical
├─ post_blocks()       # Approval requests
└─ update_message()    # After approval/rejection

TypeScript Agent (packages/agents/src/slack-flow.ts):
└─ views.open()        # Modal editing (trigger_id constraint)
```

### Airtable Migration

Airtable operations move from Composio to n8n nodes:
- n8n already has native Airtable integration
- Workflows can call Airtable directly
- No MCP needed for CRUD operations

### Google Calendar & Gmail

Handled via n8n native nodes:
- Calendar triggers via n8n polling
- Gmail context via n8n email nodes
- No MCP needed

---

## References

- [Reply Handler Research](../../specs/006-reply-handler-agent/research.md) - Original rejection decision
- [MCP Servers Spec](../../specs/mcp-servers.md) - MCP architecture
- [Composio Documentation](https://docs.composio.dev/) - Evaluation reference
- [FastMCP](https://gofastmcp.com/) - Python MCP framework used

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-20 | Initial decision documented, architecture aligned with implementation |
