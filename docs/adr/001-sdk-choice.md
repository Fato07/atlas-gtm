# ADR-001: Anthropic SDK Selection for GTM Agents

**Status**: Accepted
**Date**: 2026-01-19
**Decision Makers**: Engineering Team
**Technical Story**: SDK architecture for Lead Scorer and Reply Handler agents

---

## Context

Atlas GTM requires AI agents for GTM operations:
- **Lead Scorer**: Scores inbound leads against ICP rules
- **Reply Handler**: Classifies and responds to email replies
- **Meeting Prep** (planned): Prepares context for sales calls

We needed to choose between available SDKs for building these agents:

| Option | Description |
|--------|-------------|
| `@anthropic-ai/sdk` | General-purpose Claude API client |
| `@anthropic-ai/claude-agent-sdk` | Higher-level autonomous agent framework |
| LangChain | Multi-LLM orchestration framework |
| LlamaIndex | RAG-focused framework |

---

## Decision

**Use `@anthropic-ai/sdk` (v0.20.0)** for all GTM agents.

---

## Rationale

### 1. KV-Cache Optimization (10x Cost Savings)

The project's context engineering strategy requires precise control over token placement:

```
Cached input tokens:  $0.30 / MTok
Uncached input tokens: $3.00 / MTok  (10x more expensive)
```

**Requirements for KV-cache hits**:
- Append-only context (never modify earlier messages)
- Timestamps at END of system prompts
- Precise token budgets per agent

The Claude Agent SDK uses **auto-summarization** which would break cache prefixes and eliminate cost savings.

### 2. Python MCP Server Architecture

Atlas GTM uses **Python MCP servers** (FastMCP) for external tools:

```
mcp-servers/atlas_gtm_mcp/
├── qdrant/     # KB search tools
├── attio/      # CRM tools
└── instantly/  # Email tools
```

The current SDK works via a **bridge function** pattern:

```typescript
const callMcpTool = createMcpBridge(process.env.MCP_SERVER_URL);
const result = await callMcpTool('qdrant.search', { query, brain_id });
```

The Claude Agent SDK expects TypeScript-native MCP servers, which would require rewriting the Python tools.

### 3. Component-Based Architecture

GTM agents use **modular composition** for flexibility:

```
ReplyHandlerAgent
├── Classifier     → claude-3-5-haiku (fast, cheap)
├── Matcher        → Qdrant vector search
├── Router         → Rule-based logic
├── Responder      → claude-sonnet-4 (quality)
└── SlackFlow      → Human-in-loop approval
```

This enables:
- **Model selection per component** (Haiku for speed, Sonnet for quality)
- **Independent testing** (190 unit tests for Reply Handler alone)
- **Gradual enhancement** without full rewrites

### 4. Observability Integration

Direct SDK usage integrates cleanly with **Langfuse** tracing:

```typescript
const response = await anthropic.messages.create({
  model: 'claude-3-5-haiku-latest',
  // ... Langfuse can wrap this call directly
});
```

Higher-level frameworks add abstraction layers that complicate tracing.

### 5. Minimal Abstraction Philosophy

From the project's `CLAUDE.md`:

> "Agents: TypeScript with @anthropic-ai/sdk"

The project intentionally avoids heavy frameworks (LangChain, LlamaIndex) for:
- **Predictable token costs** (no hidden overhead)
- **Full control over prompts** (no template magic)
- **Direct debugging** (stack traces point to our code)

---

## Alternatives Considered

### Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)

**Pros**:
- Autonomous tool execution (no manual loop)
- Built-in session management
- First-class MCP support

**Cons**:
- Auto-summarization breaks KV-cache optimization
- Designed for coding agents, not GTM operations
- Less control over token costs

**Verdict**: Consider for future autonomous coding agents, not for GTM operations.

### LangChain

**Pros**:
- Multi-LLM support
- Large ecosystem of integrations

**Cons**:
- Heavy abstraction layer
- Unpredictable token costs
- Complex debugging

**Verdict**: Rejected. Too much abstraction for cost-sensitive operations.

### LlamaIndex

**Pros**:
- Excellent RAG patterns
- Good for document processing

**Cons**:
- RAG-focused, not agent-focused
- Would duplicate our Qdrant integration

**Verdict**: Rejected. We already have custom Qdrant integration optimized for our schema.

---

## Consequences

### Positive

1. **10x cost savings** through KV-cache optimization
2. **Full observability** via Langfuse integration
3. **Modular testing** with 565 passing tests
4. **Flexible model selection** per component
5. **Predictable costs** with no hidden overhead

### Negative

1. **Manual tool loops** - must implement tool execution logic
2. **Manual session management** - must handle state persistence
3. **More boilerplate** - no built-in conveniences

### Mitigations

| Negative | Mitigation |
|----------|------------|
| Manual tool loops | MCP bridge abstracts tool calls |
| Session management | State files with checkpoint pattern |
| Boilerplate | Shared patterns in `packages/lib` |

---

## When to Reconsider

Consider the Claude Agent SDK for future agents if:

1. **Autonomous coding agents** are needed (auto-fix, code review)
2. **File manipulation** is the primary operation
3. **Long-running sessions** with built-in persistence are required
4. **Cost optimization** is less critical than development speed

---

## References

- [Context Engineering Strategy](../specs/context-engineering.md)
- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Anthropic Pricing](https://www.anthropic.com/pricing) - KV-cache rates
- [CLAUDE.md](../../CLAUDE.md) - Project conventions

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-19 | Initial decision documented |
