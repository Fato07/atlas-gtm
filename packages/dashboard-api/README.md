# Dashboard API

Backend-for-Frontend (BFF) API for the Atlas Operator Dashboard. Built with Hono on Bun runtime.

## Overview

The Dashboard API serves as the backend layer for the operator dashboard, providing:
- REST endpoints for brain and KB management
- Aggregated metrics from agent state files
- Manual action triggers for agents
- Real-time activity feed
- Agent health monitoring

## Quick Start

```bash
# Install dependencies
bun install

# Start development server (port 4000)
bun run dev

# Or run directly
bun run src/index.ts
```

## Configuration

Required environment variables:

```bash
# Authentication
DASHBOARD_SECRET=your-secret-key

# MCP REST API
MCP_REST_URL=http://localhost:8100

# Agent endpoints
LEAD_SCORER_URL=http://localhost:4001
REPLY_HANDLER_URL=http://localhost:4002
MEETING_PREP_URL=http://localhost:4003
LEARNING_LOOP_URL=http://localhost:4004
```

## API Endpoints

### Health
- `GET /health` - Service health check (no auth required)

### Agents (US1)
- `GET /api/agents` - List all agent statuses

### Activity (US2)
- `GET /api/activity` - Get activity feed with pagination

### Brains (US3)
- `GET /api/brains` - List all brains
- `POST /api/brains` - Create new brain
- `GET /api/brains/:brain_id` - Get brain details
- `PUT /api/brains/:brain_id` - Update brain
- `DELETE /api/brains/:brain_id` - Delete brain

### ICP Rules (US4)
- `GET /api/brains/:brain_id/icp-rules` - List rules for brain
- `POST /api/brains/:brain_id/icp-rules` - Create rule
- `PUT /api/brains/:brain_id/icp-rules/:id` - Update rule
- `DELETE /api/brains/:brain_id/icp-rules/:id` - Delete rule
- `POST /api/brains/:brain_id/icp-rules/import` - Bulk import rules

### Response Templates (US5)
- `GET /api/brains/:brain_id/templates` - List templates
- `POST /api/brains/:brain_id/templates` - Create template
- `PUT /api/brains/:brain_id/templates/:id` - Update template
- `DELETE /api/brains/:brain_id/templates/:id` - Delete template

### Objection Handlers (US6)
- `GET /api/brains/:brain_id/handlers` - List handlers
- `POST /api/brains/:brain_id/handlers` - Create handler
- `PUT /api/brains/:brain_id/handlers/:id` - Update handler
- `DELETE /api/brains/:brain_id/handlers/:id` - Delete handler
- `POST /api/brains/:brain_id/handlers/test` - Test pattern match

### Market Research (US7)
- `GET /api/brains/:brain_id/research` - List research items
- `POST /api/brains/:brain_id/research` - Create research item
- `PUT /api/brains/:brain_id/research/:id` - Update research item
- `DELETE /api/brains/:brain_id/research/:id` - Delete research item

### Pending Validations (US8)
- `GET /api/pending` - List pending items
- `POST /api/pending/:id/approve` - Approve item
- `POST /api/pending/:id/reject` - Reject item

### Metrics (US9)
- `GET /api/metrics` - Get aggregated metrics
- `GET /api/metrics/summary` - Get metrics summary

### Actions (US10)
- `POST /api/actions/score-lead` - Trigger lead scoring
- `POST /api/actions/generate-brief` - Trigger brief generation

## Authentication

All `/api/*` routes require the `X-Dashboard-Secret` header:

```bash
curl -H "X-Dashboard-Secret: $DASHBOARD_SECRET" \
  http://localhost:4000/api/brains
```

## Data Contract Architecture

This API follows a **schema-first validated BFF pattern**:

1. **Zod schemas** in `src/contracts/` define the dashboard data contracts
2. **MCP services** in `src/services/` validate MCP responses against explicit schemas
3. **Transformations** are explicit with input AND output validation

Example from `brains.ts`:
```typescript
// 1. Validate MCP response
const mcpBrain = McpBrainResponseSchema.parse(raw);
// 2. Transform (explicit mapping)
const brain = { brain_id: mcpBrain.brain_id, ... };
// 3. Validate output
return BrainSchema.parse(brain);
```

See [docs/architecture/data-contracts.md](/docs/architecture/data-contracts.md) for details.

## Architecture

```
src/
├── index.ts           # Entry point, Hono app setup
├── middleware/
│   ├── auth.ts        # Secret-based authentication
│   └── logging.ts     # Structured request logging
├── contracts/         # Zod schemas for request/response
│   ├── brain.ts
│   ├── icp-rule.ts
│   ├── response-template.ts
│   ├── objection-handler.ts
│   ├── market-research.ts
│   ├── activity-event.ts
│   ├── agent-status.ts
│   └── pending-item.ts
├── routes/            # Route handlers
│   ├── agents.ts
│   ├── activity.ts
│   ├── brains.ts
│   ├── icp-rules.ts
│   ├── templates.ts
│   ├── handlers.ts
│   ├── research.ts
│   ├── pending.ts
│   ├── metrics.ts
│   └── actions.ts
└── services/          # Business logic
    ├── mcp-client.ts  # MCP REST API client
    ├── brains.ts
    ├── icp-rules.ts
    ├── templates.ts
    ├── handlers.ts
    ├── research.ts
    ├── pending-items.ts
    ├── activity-log.ts
    ├── agent-health.ts
    └── metrics.ts
```

## Development

```bash
# Type checking
bun run typecheck

# Run tests
bun test
```

## Related

- [Dashboard UI](../dashboard-ui/README.md) - Frontend React application
- [MCP Server](../../mcp-servers/atlas_gtm_mcp/README.md) - Python MCP server
