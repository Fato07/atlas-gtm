# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Atlas GTM project.

## What is an ADR?

An ADR is a document that captures an important architectural decision made along with its context and consequences.

## ADR Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [001](001-sdk-choice.md) | Anthropic SDK Selection for GTM Agents | Accepted | 2026-01-19 |
| [002](002-composio-mcp-decision.md) | Custom MCP Servers over Composio | Accepted | 2026-01-20 |

## ADR Template

When creating a new ADR, use this structure:

```markdown
# ADR-XXX: Title

**Status**: Proposed | Accepted | Deprecated | Superseded
**Date**: YYYY-MM-DD
**Decision Makers**: Team/individuals involved

## Context
What is the issue that we're seeing that is motivating this decision?

## Decision
What is the change that we're proposing and/or doing?

## Rationale
Why is this decision being made? What are the key factors?

## Alternatives Considered
What other options were evaluated?

## Consequences
What becomes easier or more difficult to do because of this change?
```

## References

- [ADR GitHub Organization](https://adr.github.io/)
- [Michael Nygard's ADR Article](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
