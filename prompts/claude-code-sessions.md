# Claude Code Session Prompts
## Copy-Paste Prompts for Each Development Phase

---

## How to Use

Each section below contains a prompt you can paste into Claude Code to start that phase of development. The prompts reference the spec files we've created.

---

## Session 1: Infrastructure Setup

**When**: Week 1, Day 1-2

```
# GTM Operations System - Infrastructure Setup

I'm building an AI-first GTM system. Please help me continue setting up the foundational infrastructure.

## Context
Read these spec files for full context:
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/ARCHITECTURE.md
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/specs/knowledge-base.md

## What to Build

1. **Docker Compose Stack**
   Create docker-compose.yml with:
   - n8n (port 5678)
   - Qdrant (port 6333)
   - PostgreSQL (for n8n)
   - Nginx (reverse proxy with SSL)

   Note: Using Upstash for Redis (serverless) - no self-hosted Redis needed

2. **Qdrant Collections**
   Create Python script to initialize all collections:
   - brains
   - icp_rules
   - response_templates
   - objection_handlers
   - market_research
   - insights
   - verticals

   Use the schemas from specs/knowledge-base.md

3. **Voyage AI Integration**
   Create embedding utility:
   - embed_document(text) -> vector
   - embed_query(text) -> vector
   - Use voyage-3.5-lite model, 512 dimensions

4. **Environment Configuration**

```

---

## Session 2: Qdrant MCP Server

**When**: Week 1, Day 3-4

```
# GTM Operations System - Qdrant MCP Server

Build the custom MCP server for Knowledge Base operations.

## Context
Read these spec files:
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/specs/knowledge-base.md
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/specs/mcp-servers.md

## What to Build

Create a FastMCP server with these tools:

1. **query_icp_rules(brain_id, query, limit)**
   - Semantic search ICP rules
   - Filter by brain_id
   - Return rules with scores

2. **get_response_template(brain_id, reply_type, tier)**
   - Get templates by type and tier
   - Filter by brain_id

3. **find_objection_handler(brain_id, objection_text)**
   - Semantic search for matching handler
   - Return best match with confidence

4. **search_market_research(brain_id, query, limit)**
   - Semantic search research docs
   - Return with relevance scores

5. **add_insight(brain_id, content, category, source, importance)**
   - Add new insight with quality gate
   - Check for duplicates
   - Calculate confidence

6. **get_brain(vertical)** / **list_brains()**
   - Brain management tools

## Technical Requirements
- Use FastMCP framework
- Connect to Qdrant at localhost:6333
- Use Voyage AI for embeddings
- Include error handling
- Add request logging


Start with the basic server structure, then implement each tool.
```

---

## Session 3: Brain Seeder

# GTM Operations System - Brain Seeder

Build the workflow to seed the initial Aero brain with content.

## Context
Read these spec files, understand the context, and make any clarifications:
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/specs/knowledge-base.md
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/specs/brain-swapping.md

## What to Build

1. **Brain Creation**
   - Create a new brain record in Qdrant
   - Set up default configuration
   - Initialize with status "draft"

2. **Content Seeder**
   Functions to seed:
   - `seed_icp_rules(brain_id, rules: list[dict])`
   - `seed_templates(brain_id, templates: list[dict])`
   - `seed_handlers(brain_id, handlers: list[dict])`
   - `seed_research(brain_id, docs: list[dict])`

3. **Research Parser**
   - Parse Claude research output into structured format
   - Extract ICP signals, pain points, objections
   - Format for ingestion

4. **Seed Data Files**
   Create JSON seed files:
   - `data/seeds/iro-brain-v1.json` (brain config)
   - `data/seeds/iro-icp-rules.json` (30+ rules)
   - `data/seeds/iro-templates.json` (10+ templates)
   - `data/seeds/iro-handlers.json` (10+ handlers)

5. **CLI Script**
   `python seed_brain.py --brain iro --file data/seeds/iro-brain-v1.json`

## Example ICP Rules to Include

```json
[
  {
    "category": "firmographic",
    "attribute": "company_size",
    "condition": {"type": "range", "min": 50, "max": 500},
    "score_weight": 30,
    "reasoning": "Sweet spot for IR needs"
  },
  {
    "category": "firmographic",
    "attribute": "title",
    "condition": {"type": "contains", "value": "investor relations"},
    "score_weight": 25,
    "reasoning": "Direct IR role = high relevance"
  }
]
```

Start with the brain creation, then build the seeding functions.
```

---

## Session 4: Lead Scorer Agent

**When**: Week 2

```
# GTM Operations System - Lead Scorer Agent

Build the Lead Scorer agent that evaluates leads against KB rules.

## Context
Read these spec files:
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/specs/agent-lead-scorer.md
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/specs/knowledge-base.md

## What to Build

1. **Scoring Agent**
   Core logic:
   - Detect vertical from lead data
   - Load appropriate brain
   - Query ICP rules
   - Score each attribute
   - Calculate total score and tier
   - Recommend messaging angle

2. **Claude Prompts**
   Create prompts for:
   - Rule application
   - Score calculation
   - Angle recommendation

3. **n8n Workflow**
   Trigger: Webhook or scheduled
   Steps:
   - Fetch unscored leads from Airtable
   - For each lead: score via agent
   - Update Airtable with results
   - Notify Slack for Tier 2

4. **Slack Notifications**
   Format Tier 2 review requests with:
   - Lead summary
   - Score breakdown
   - Approve/Reject buttons

## Input/Output Schemas

```python
# Input
class LeadInput:
    lead_id: str
    email: str
    company: str
    title: str
    company_size: int
    industry: str
    # ... more fields

# Output
class ScoringResult:
    lead_id: str
    score: int  # 0-100
    tier: str  # priority, standard, low, reject
    scoring_breakdown: list
    recommended_angle: str
    brain_used: str
```

Start with the core scoring logic, then build the n8n workflow.
```

---

## Session 5: Reply Handler Agent

**When**: Week 3

```
# GTM Operations System - Reply Handler Agent

Build the Reply Handler agent that classifies and responds to replies.

## Context
Read these spec files:
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/specs/agent-reply-handler.md
- /Users/fathindosunmu/DEV/MProjects/atlas-gtm/specs/mcp-servers.md

## What to Build

1. **Reply Classification**
   - Parse reply content (extract from thread)
   - Classify intent (positive, question, objection, etc.)
   - Analyze sentiment (-1 to 1)
   - Assess complexity (simple, medium, complex)

2. **KB Matching**
   - Match to response templates
   - Match to objection handlers
   - Calculate confidence scores

3. **Tier Routing**
   - Tier 1: Auto-respond
   - Tier 2: Draft for Slack approval
   - Tier 3: Escalate to human

4. **Response Generation**
   - Generate from template
   - Personalize with lead context
   - Apply Claude for customization

5. **Slack Approval Flow**
   - Format approval request with buttons
   - Handle button clicks (approve, edit, reject)
   - Timeout handling (30 min)

6. **CRM Updates**
   - Update Airtable status
   - Create/update Attio record
   - Add activity to Attio

7. **n8n Workflow**
   Trigger: Instantly webhook
   Steps: Classify -> Match -> Route -> Execute

## Instantly MCP Server
Also build the Instantly MCP server:
- get_email_thread(email)
- send_reply(thread_id, message)
- get_recent_replies(since_hours)

Start with classification, then matching, then the full flow.
```

---

## Session 6: Attio MCP Server

**When**: Week 4

```
# GTM Operations System - Attio MCP Server

Build the custom MCP server for Attio CRM operations.

## Context
Read the MCP servers spec:
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/specs/mcp-servers.md

## What to Build

1. **Attio API Client**
   Wrapper for Attio REST API:
   - Authentication handling
   - Rate limiting
   - Error handling

2. **MCP Tools**
   - find_person(email) -> person record
   - create_person(email, name, company, ...) -> new record
   - update_person(record_id, fields) -> updated record
   - update_pipeline_stage(record_id, stage)
   - add_activity(record_id, type, content, metadata)
   - create_task(record_id, title, due_date, assigned_to)
   - get_pipeline_records(stage, limit)
   - get_record_activities(record_id, limit)

3. **Pipeline Stage Mapping**
   Define stages:
   - new_reply
   - qualifying
   - meeting_scheduled
   - meeting_held
   - proposal
   - closed_won
   - closed_lost

## Attio API Reference
Base URL: https://api.attio.com/v2
Auth: Bearer token in header
Key endpoints:
- GET/POST /objects/people
- GET/POST /records/{record_id}/activities
- GET/POST /lists/{list_id}/entries

## Output Structure
```
mcp-servers/
└── attio_mcp/
    ├── __init__.py
    ├── server.py
    ├── client.py
    ├── tools.py
    └── schemas.py
```

Start with the API client, then implement each tool.
```

---

## Session 7: Meeting Prep Agent

**When**: Week 5

```
# GTM Operations System - Meeting Prep Agent

Build the Meeting Prep agent for pre-call briefs and post-meeting analysis.

## Context
Read the spec:
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/specs/agent-meeting-prep.md

## What to Build

1. **Calendar Integration**
   - Google Calendar webhook for "meeting in 30 min"
   - Parse attendees, extract external email
   - Find matching lead/company

2. **Context Gatherer**
   Parallel data gathering:
   - Email thread (Instantly)
   - LinkedIn messages (if available)
   - Lead data (Airtable)
   - Attio record (full history)
   - KB research (similar companies)
   - KB handlers (likely objections)

3. **Brief Generator**
   Claude prompt to generate:
   - Quick context
   - Conversation timeline
   - Company intel
   - Likely discussion points
   - Suggested questions
   - Watch out for (objections)
   - Similar won deal

4. **Slack Delivery**
   - Format as Slack blocks
   - Include call link
   - Send to meeting briefs channel

5. **Post-Meeting Analysis**
   Input: Transcript or notes
   Extract:
   - Qualification assessment (BANT)
   - Objections raised
   - Action items
   - Key quotes
   - Next steps

6. **CRM Updates**
   - Update pipeline stage
   - Add meeting notes
   - Create follow-up tasks
   - Extract insights to KB

## n8n Workflows
- meeting_brief.json (pre-call)
- meeting_analysis.json (post-call)


Start with context gathering, then brief generation.
```

---

## Session 8: Learning Loop

**When**: Week 6

```
# GTM Operations System - Learning Loop

Build the insight extraction and KB learning system.

## Context
Read relevant specs:
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/specs/knowledge-base.md
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/specs/brain-swapping.md

## What to Build

1. **Insight Extractor**
   From reply/call content, extract:
   - Buying process signals
   - Pain points
   - New objection patterns
   - Competitive intel
   - Messaging effectiveness

2. **Quality Gates**
   Before adding to KB:
   - Confidence score calculation
   - Duplicate detection (semantic)
   - Source credibility check
   - Importance classification

3. **Validation Queue**
   For high-importance insights:
   - Send to Slack for human review
   - Approve/reject buttons
   - Add validation notes

4. **KB Writer**
   - Add validated insights to Qdrant
   - Update brain stats
   - Track insight sources (provenance)

5. **Weekly Synthesis**
   Scheduled report:
   - Top objections this week
   - Best performing templates
   - ICP signals observed
   - Recommendations

6. **Template Performance Tracking**
   - Track usage count
   - Track success rate
   - Update template stats

Start with insight extraction, then quality gates.
```

---

## Session 9: Dashboard & Optimization

**When**: Week 7

```
# GTM Operations System - Dashboard & Metrics

Build the metrics collection and dashboard.

## What to Build

1. **Metrics Collector**
   Daily sync to collect:
   - Leads scored (by tier)
   - Replies received (by intent)
   - Auto-response rate
   - Approval wait times
   - Meetings booked
   - Pipeline value

2. **Dashboard (Airtable or Custom)**
   Views:
   - Weekly summary
   - Pipeline by stage
   - Template performance
   - Brain comparison

3. **A/B Testing Framework**
   For templates:
   - Assign variants (A/B)
   - Track performance per variant
   - Statistical significance calculation

4. **Performance Alerts**
   Slack alerts when:
   - Auto-response rate drops
   - Queue backing up
   - Error rate spikes

## Metrics to Track

```python
METRICS = {
    "leads_scored_total": Counter,
    "leads_scored_by_tier": Counter,  # tier label
    "replies_received_total": Counter,
    "replies_by_intent": Counter,  # intent label
    "auto_response_rate": Gauge,
    "approval_wait_time_seconds": Histogram,
    "meetings_booked_total": Counter,
    "pipeline_value_total": Gauge,
    "kb_queries_total": Counter,
    "kb_query_latency_ms": Histogram,
}
```

## Output Structure
```
src/
└── monitoring/
    ├── __init__.py
    ├── metrics.py
    ├── dashboard.py
    └── alerts.py
workflows/
└── n8n/
    └── daily_metrics.json
```
```

---

## Session 10: Multi-Vertical & Brain Swapping

**When**: Week 8

```
# GTM Operations System - Multi-Vertical Support

Implement full brain swapping for multiple verticals.

## Context
Read:
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/specs/brain-swapping.md

## What to Build

1. **Brain Manager**
   - get_brain(vertical, brain_id)
   - set_active_brain(brain_id)
   - list_brains()
   - create_brain(name, vertical, config)
   - copy_brain(source_id, new_name)

2. **Vertical Detector**
   Infer vertical from:
   - Lead data (industry, title)
   - Campaign ID
   - Explicit tag

3. **Brain Seeder v2**
   - Create brain from template
   - Seed from research output
   - Copy rules from parent brain

4. **Slack Commands**
   - /brain list
   - /brain active
   - /brain switch <id>
   - /brain stats <id>

5. **Second Brain (Defense or Healthcare)**
   Create seed data for second vertical

6. **Performance Comparison**
   Report comparing:
   - Brain A vs Brain B
   - Conversion rates
   - Engagement rates

## Brain Switching Flow

```python
# In any agent:
lead = get_lead(lead_id)
vertical = VerticalDetector().detect(lead)
brain = brain_manager.get_brain(vertical=vertical)

# All KB queries scoped to brain
rules = brain_manager.get_icp_rules(brain)
templates = brain_manager.get_templates(brain, reply_type="positive")
```

Start with brain manager, then vertical detection, then second brain.
```

---

## Session 11: Langfuse Observability

**When**: Week 3-4

```
# GTM Operations System - Langfuse Observability

Add observability layer to trace all agent operations.

## Context
Read these spec files:
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/specs/observability.md
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/specs/agent-lead-scorer.md

## What to Build

1. **Langfuse Client Module**
   Location: packages/lib/src/observability/
   - langfuse-client.ts: Singleton client initialization
   - tracing.ts: Trace/span creation helpers
   - scoring.ts: Custom quality score helpers
   - types.ts: TypeScript interfaces

2. **Lead Scorer Integration**
   Instrument these files:
   - packages/agents/src/lead-scorer/agent.ts
     - Wrap scoreLead() with traces
     - Record tier and confidence scores
   - packages/agents/src/lead-scorer/angles.ts
     - Wrap callClaudeForAngle() with generation tracking
     - Track token usage
   - packages/agents/src/lead-scorer/webhook.ts
     - Initialize Langfuse on startup
     - Clean shutdown

3. **Custom Scores**
   Implement these quality metrics:
   - lead_scoring_accuracy (numeric, 0-1)
   - angle_quality (numeric, 0-1)
   - tier_correctness (categorical: hot/warm/cold)
   - vertical_confidence (numeric, 0-1)

4. **Environment Setup**
   Add to .env.example:
   - LANGFUSE_PUBLIC_KEY
   - LANGFUSE_SECRET_KEY
   - LANGFUSE_BASE_URL (optional)

## Usage Pattern

```typescript
import { createLeadScoringTrace, recordLeadScoringResults } from '@atlas-gtm/lib/observability';

const trace = createLeadScoringTrace({ leadId, brainId });
// ... scoring logic ...
recordLeadScoringResults(trace.id, { tier, score, confidence });
endLeadScoringTrace(trace.id, true);
```

Start with the observability module, then integrate into Lead Scorer.
```

---

## Session 12: Ragas RAG Evaluation

**When**: Week 5-6

```
# GTM Operations System - RAG Evaluation

Build evaluation framework to measure retrieval quality.

## Context
Read these spec files:
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/specs/evaluation.md
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/specs/knowledge-base.md

## What to Build

1. **Evaluation Module**
   Location: mcp-servers/atlas_gtm_mcp/evaluation/
   - config.py: Thresholds per collection
   - evaluators/qdrant_evaluator.py: Main Ragas evaluator
   - evaluators/collection_evaluator.py: Batch evaluation
   - datasets/loader.py: Golden dataset loading
   - reporters/json_reporter.py: JSON output
   - reporters/langfuse_reporter.py: Langfuse integration
   - cli.py: Command-line interface

2. **Golden Datasets**
   Create test cases for each collection:
   - datasets/icp_rules_golden.json (50+ cases)
   - datasets/response_templates_golden.json (50+ cases)
   - datasets/objection_handlers_golden.json (50+ cases)
   - datasets/market_research_golden.json (50+ cases)

3. **Ragas Metrics**
   Implement tracking for:
   - context_precision (target: ≥0.80)
   - context_recall (target: ≥0.75)
   - faithfulness (target: ≥0.85)
   - answer_relevancy (target: ≥0.80)

4. **CLI Usage**
   ```bash
   # Run evaluation
   uv run python -m atlas_gtm_mcp.evaluation.cli evaluate --collection icp_rules

   # List datasets
   uv run python -m atlas_gtm_mcp.evaluation.cli list
   ```

5. **CI/CD Integration**
   Create GitHub Actions workflow:
   - .github/workflows/rag-evaluation.yml
   - Run on KB changes
   - Daily scheduled evaluation
   - Fail on threshold breaches

## Test Case Structure

```json
{
  "id": "icp_001",
  "question": "What company size is ideal?",
  "expected_contexts": ["Company size rule: 50-500 employees"],
  "ground_truth": "Target companies with 50-500 employees",
  "brain_id": "brain_iro_v1"
}
```

Start with the evaluator, then golden datasets, then CLI.
```

---

## Session 13: Lakera Guard Security

**When**: Week 7-8

```
# GTM Operations System - Security Layer

Add security screening for prompt injection and PII protection.

## Context
Read these spec files:
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/specs/security.md
- /Users/fathindosunmu/DEV/MyProjects/atlas-gtm/specs/agent-lead-scorer.md

## What to Build

1. **Security Module**
   Location: packages/lib/src/security/
   - types.ts: Threat types, actions, config
   - lakera-guard.ts: API client
   - security-middleware.ts: Screening middleware
   - security-logger.ts: Audit logging

2. **Threat Handling**
   Configure actions for:
   - prompt_injection: BLOCK
   - jailbreak: BLOCK
   - pii: MASK (replace with [TYPE_REDACTED])
   - content_moderation: WARN

3. **Agent Integration**
   Integrate into Lead Scorer:
   - angles.ts: Screen prompts before Claude calls
   - webhook.ts: Screen incoming webhook data

4. **PII Masking**
   Support masking for:
   - email, phone, ssn, credit_card
   - name, address, date_of_birth, ip_address

5. **Audit Logging**
   Log all security events:
   - requestId, source, action
   - threatCategory, severity
   - piiCount, piiTypes
   - latencyMs, passed

6. **Environment Setup**
   Add to .env.example:
   - LAKERA_GUARD_API_KEY
   - LAKERA_PROJECT_ID (optional)

## Usage Pattern

```typescript
import { screenBeforeLLM, isLakeraGuardEnabled } from '@atlas-gtm/lib/security';

if (isLakeraGuardEnabled()) {
  const result = await screenBeforeLLM(prompt, 'lead_scorer');
  if (!result.passed) {
    throw new SecurityError(result.reason);
  }
  prompt = result.sanitizedContent ?? prompt;
}
```

Start with the Lakera client, then middleware, then integration.
```

---

## Quick Reference

| Session | Week | Focus | Key Deliverable |
|---------|------|-------|-----------------|
| 1 | W1 | Infrastructure | Docker + Qdrant + n8n |
| 2 | W1 | Qdrant MCP | KB query tools |
| 3 | W1 | Brain Seeder | IRO brain content |
| 4 | W2 | Lead Scorer | Scoring agent live |
| 5 | W3 | Reply Handler | Auto-responses |
| 6 | W4 | Attio MCP | CRM integration |
| 7 | W5 | Meeting Prep | Pre-call briefs |
| 8 | W6 | Learning | Insight extraction |
| 9 | W7 | Dashboard | Metrics & tuning |
| 10 | W8 | Multi-Vertical | Brain swapping |
| **11** | **W3-4** | **Observability** | **Langfuse tracing** |
| **12** | **W5-6** | **Evaluation** | **Ragas RAG metrics** |
| **13** | **W7-8** | **Security** | **Lakera Guard** |

---

*Copy the relevant prompt when starting each Claude Code session. Adjust file paths as needed.*
