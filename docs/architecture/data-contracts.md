# Data Contracts Architecture

> Schema-First Design with Validated BFF Pattern

## Overview

Atlas GTM uses a **schema-first architecture** where Zod schemas in the dashboard API serve as the single source of truth for data contracts. This document explains the pattern, why it exists, and how to maintain it.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SINGLE SOURCE OF TRUTH                           │
│            packages/dashboard-api/src/contracts/*.ts                │
│                      (Zod Schemas)                                  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                   Types derived via z.infer<>
                                │
                                ▼
┌─────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Qdrant    │───▶│  MCP REST API       │───▶│  Dashboard API      │
│  (Storage)  │    │  (Data Provider)    │    │  (BFF + Validation) │
└─────────────┘    └─────────────────────┘    └─────────────────────┘
                                                        │
                        Validated against               │
                        Zod Schema ────────────────────▶│
                                                        ▼
                                               ┌─────────────────────┐
                                               │  React UI           │
                                               │  (Type-safe Props)  │
                                               └─────────────────────┘
```

## Key Principles

### 1. Zod Schemas Are the Source of Truth

All data contracts are defined as Zod schemas in `packages/dashboard-api/src/contracts/`:

```typescript
// packages/dashboard-api/src/contracts/brain.ts
export const BrainSchema = z.object({
  brain_id: z.string().regex(/^brain_[a-z0-9_]+$/),
  name: z.string().min(1).max(100),
  vertical: z.string().min(1).max(50),
  status: BrainStatusSchema,
  config: BrainConfigSchema,
  stats: BrainStatsSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Types are DERIVED, not duplicated
export type Brain = z.infer<typeof BrainSchema>;
```

### 2. MCP is a Data Provider (May Have Different Structure)

The MCP Python layer returns data from Qdrant, which may have a different structure than what the dashboard expects. This is normal and intentional.

```python
# MCP returns (Python)
{
    "brain_id": "brain_fintech_v1",
    "name": "Fintech Brain",
    "vertical": "fintech",
    "version": "1.0",
    "status": "active",
    "description": "...",
    "config": {...},
    "stats": {...},
    "created_at": "...",
    "updated_at": "..."
}
```

### 3. Dashboard API Validates at the Boundary

The dashboard API service layer validates MCP responses against explicit schemas:

```typescript
// packages/dashboard-api/src/services/brains.ts

// Schema for what MCP returns (SOURCE contract)
const McpBrainResponseSchema = z.object({
  brain_id: z.string(),
  name: z.string(),
  vertical: z.string(),
  version: z.string().optional(),
  status: z.string().default('draft'),
  description: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  stats: z.record(z.number()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

function transformMcpBrain(raw: unknown): Brain {
  // 1. Validate MCP response
  const mcpBrain = McpBrainResponseSchema.parse(raw);

  // 2. Transform to dashboard contract
  const brain = { /* ... transform ... */ };

  // 3. Validate output
  return BrainSchema.parse(brain);
}
```

### 4. Transformations Are Explicit and Tested

Transformation functions:
- Validate input against source schema (fails loudly if MCP changes)
- Transform with explicit field mappings (documented, reviewable)
- Validate output against target schema (catches transformation bugs)

## Why This Pattern?

### Problem: Schema Drift

Without explicit contracts, schema changes cause "shotgun surgery":
- MCP returns a new field structure
- Dashboard expects the old structure
- Silent `undefined` values propagate through the UI
- Debugging is painful because errors are far from the cause

### Solution: Contract-First Design

| Before | After |
|--------|-------|
| Silent `as string` casts | Zod `.parse()` validation |
| Undefined on missing fields | Throws with clear error message |
| Schema duplicated in code | Schema is the source of truth |
| No contract for MCP response | Explicit `McpBrainResponseSchema` |

## When Transformations ARE Appropriate

This pattern follows the **Backend-for-Frontend (BFF)** design:

| Use Case | Appropriate? |
|----------|--------------|
| Frontend needs subset of MCP data | ✅ Yes |
| Decouple frontend from MCP evolution | ✅ Yes |
| Aggregate data from multiple sources | ✅ Yes |
| Just passing through unchanged | ❌ No - use direct type |

## Maintenance Guide

### Adding a New Entity

1. **Create the target schema** in `packages/dashboard-api/src/contracts/`:
   ```typescript
   export const NewEntitySchema = z.object({...});
   export type NewEntity = z.infer<typeof NewEntitySchema>;
   ```

2. **Create the MCP response schema** in the service file:
   ```typescript
   const McpNewEntityResponseSchema = z.object({...});
   ```

3. **Create the transform function** with validation:
   ```typescript
   function transformMcpNewEntity(raw: unknown): NewEntity {
     const mcp = McpNewEntityResponseSchema.parse(raw);
     // ... transform ...
     return NewEntitySchema.parse(result);
   }
   ```

### When MCP Changes Format

1. **Update `McpBrainResponseSchema`** to match new MCP output
2. **Update transform function** if field mapping changed
3. **Tests will catch** if validation fails
4. **Dashboard schema unchanged** (frontend is decoupled)

### Debugging Validation Errors

When Zod validation fails, you'll see errors like:

```
[brains] Failed to transform brain at index 0: ZodError: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined",
    "path": ["brain_id"],
    "message": "Required"
  }
]
[brains] Raw brain data: {"id": "...", ...}
```

This immediately tells you:
1. Which field is wrong (`brain_id`)
2. What was expected (`string`)
3. What was received (`undefined`)
4. The raw data for debugging

## File Reference

| File | Purpose |
|------|---------|
| `packages/dashboard-api/src/contracts/*.ts` | Zod schemas (source of truth) |
| `packages/dashboard-api/src/services/brains.ts` | Brain service with MCP validation |
| `mcp-servers/atlas_gtm_mcp/qdrant/__init__.py` | MCP Python layer (data provider) |

## Related Documentation

- [Data Flow Architecture](./data-flow.md) - System-wide data flow diagrams
- [Knowledge Base Spec](../../specs/knowledge-base.md) - KB design decisions
