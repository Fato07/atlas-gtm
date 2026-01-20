# Atlas GTM Data Flow Architecture

> **Last Updated**: 2026-01-20
> **Version**: 1.1
> **Status**: Active - Meeting Prep Agent complete

---

## Table of Contents

1. [Implementation Status](#implementation-status)
2. [System Overview](#system-overview)
3. [Overview Flow Diagram](#overview-flow-diagram)
4. [Agent Communication Overview](#agent-communication-overview)
5. [Lead Scorer Flow](#lead-scorer-flow)
6. [Reply Handler Flow](#reply-handler-flow)
7. [Meeting Prep Agent Flow](#meeting-prep-agent-flow)
8. [Brain Lifecycle Flow](#brain-lifecycle-flow)
9. [Component Architecture](#component-architecture)
10. [Glossary](#glossary)
11. [Change Log](#change-log)

---

## Implementation Status

> **Legend**: ✅ Implemented | 🚧 In Progress | 📋 Planned

### Agents

| Component | Status | Branch/PR | Notes |
|-----------|--------|-----------|-------|
| Lead Scorer Agent | ✅ | `004-lead-scorer` | Scoring, tiers, angles, Slack notifications |
| Reply Handler Agent | ✅ | `006-reply-handler-agent` | Classification, KB matching, tier routing |
| Meeting Prep Agent | ✅ | `008-meeting-prep-agent` | Pre-call briefs, post-call analysis, Slack delivery |

### MCP Servers

| Component | Status | Branch/PR | Notes |
|-----------|--------|-----------|-------|
| Qdrant MCP | ✅ | `002-qdrant-mcp` | KB queries, brain management |
| Brain Lifecycle | ✅ | `003-brain-lifecycle` | Create, seed, activate brains |
| Attio MCP | ✅ | `007-attio-mcp-server` | CRM operations, pipeline management |
| MCP REST API | ✅ | `008-meeting-prep-agent` | HTTP wrapper for MCP tools (:8100) |
| Instantly MCP | 📋 | - | Email campaign integration |
| LinkedIn MCP | 📋 | - | LinkedIn automation |

### Infrastructure

| Component | Status | Branch/PR | Notes |
|-----------|--------|-----------|-------|
| Qdrant + Docker | ✅ | `001-gtm-infra` | Vector DB, 7 collections |
| n8n Workflows | ✅ | `001-gtm-infra` | Batch triggers, webhooks |
| State Management | ✅ | `004-lead-scorer` | JSON checkpoint files |

---

## System Overview

Atlas GTM is an AI-first GTM Operations System that uses swappable "brains" (vertical-specific knowledge bases) to enable rapid market validation. The core concept: **same agents, different brains** for rapid multi-vertical market validation.

### Key Architectural Patterns

1. **Brain-Scoped Queries**: Every KB query MUST include `brain_id` filter
2. **Tier-Based Routing**: Leads/replies routed to Tier 1 (auto), Tier 2 (approval), or Tier 3 (human)
3. **MCP Tool Integration**: Agents use MCP servers for external integrations
4. **State Persistence**: Long-running operations checkpoint to state files

---

## Overview Flow Diagram

```mermaid
flowchart TB
    subgraph Entry["Entry Points"]
        WH_LS[/"Webhook: /score-lead"/]
        WH_RH[/"Webhook: /handle-reply"/]
        WH_MP[/"Webhook: /meeting-prep<br/>(brief, analyze)"/]
        CAL_WH[/"Calendar Webhook<br/>(30 min before)"/]
        SLACK_CMD[/"Slack /brief Command"/]
        N8N_SCHED[("n8n Scheduled<br/>Batch Trigger")]
        INSTANTLY[/"Instantly Email<br/>Reply Webhook"/]
    end

    subgraph Agents["AI Agents (TypeScript/Bun)"]
        LS["Lead Scorer Agent<br/>Context: 80k tokens<br/>:3001"]
        RH["Reply Handler Agent<br/>Context: 60k tokens<br/>:3002"]
        MP["Meeting Prep Agent<br/>Context: 100k tokens<br/>:3003"]
    end

    subgraph Brain["Brain System (Qdrant)"]
        BRAIN_SEL{{"Vertical Detection<br/>→ Brain Selection"}}
        KB[("Knowledge Base<br/>• ICP Rules<br/>• Templates<br/>• Objection Handlers<br/>• Market Research<br/>• Insights")]
    end

    subgraph MCPLayer["MCP Layer"]
        MCP_REST["MCP REST API<br/>:8100"]
        subgraph MCP["MCP Servers (Python FastMCP)"]
            QDRANT_MCP["Qdrant MCP"]
            ATTIO_MCP["Attio MCP"]
            INSTANTLY_MCP["Instantly MCP"]
        end
    end

    subgraph External["External Systems"]
        AIRTABLE[("Airtable<br/>Lead Database")]
        ATTIO[("Attio CRM")]
        SLACK["Slack<br/>Approvals & Briefs"]
        EMAIL["Email<br/>(via Instantly)"]
        REDIS[("Upstash Redis<br/>Research Cache")]
        CLAUDE["Claude API"]
    end

    subgraph State["State Management"]
        STATE_FILE[/"state/*.json<br/>Session Checkpoints"/]
    end

    %% Entry to Agents
    WH_LS --> LS
    N8N_SCHED --> LS
    WH_RH --> RH
    INSTANTLY --> RH
    WH_MP --> MP
    CAL_WH --> MP
    SLACK_CMD --> MP

    %% Agent to Brain
    LS --> BRAIN_SEL
    RH --> BRAIN_SEL
    MP --> BRAIN_SEL
    BRAIN_SEL --> KB

    %% KB queries via MCP REST
    KB <-.-> MCP_REST
    MCP_REST --> QDRANT_MCP
    MCP_REST --> ATTIO_MCP
    MCP_REST --> INSTANTLY_MCP

    %% Agent to MCP REST
    LS --> MCP_REST
    RH --> MCP_REST
    MP --> MCP_REST

    %% MCP to External
    ATTIO_MCP --> ATTIO
    INSTANTLY_MCP --> EMAIL

    %% Agent to External (direct)
    LS --> AIRTABLE
    LS --> SLACK
    RH --> AIRTABLE
    RH --> SLACK
    RH --> EMAIL
    MP --> SLACK
    MP --> REDIS
    MP --> CLAUDE

    %% State persistence
    LS --> STATE_FILE
    RH --> STATE_FILE
    MP --> STATE_FILE

    %% Styling
    classDef entry fill:#e1f5fe,stroke:#01579b
    classDef agent fill:#fff3e0,stroke:#e65100
    classDef brain fill:#f3e5f5,stroke:#7b1fa2
    classDef mcp fill:#e8f5e9,stroke:#2e7d32
    classDef external fill:#fce4ec,stroke:#880e4f
    classDef state fill:#fffde7,stroke:#f57f17
    classDef rest fill:#bbdefb,stroke:#1976d2

    class WH_LS,WH_RH,WH_MP,CAL_WH,SLACK_CMD,N8N_SCHED,INSTANTLY entry
    class LS,RH,MP agent
    class BRAIN_SEL,KB brain
    class QDRANT_MCP,ATTIO_MCP,INSTANTLY_MCP mcp
    class MCP_REST rest
    class AIRTABLE,ATTIO,SLACK,EMAIL,REDIS,CLAUDE external
    class STATE_FILE state
```

### Data Flow Summary

| Path | Description | Volume |
|------|-------------|--------|
| Webhook → Lead Scorer → KB → Airtable/Slack | Single lead scoring | ~100-500/day |
| n8n Schedule → Lead Scorer → Batch Processing | Batch lead scoring | 50-100 per batch |
| Instantly → Reply Handler → KB → Auto/Approval/Escalate | Reply processing | 100-500 replies/day |
| Calendar → Meeting Prep → Brief → Slack | Pre-call brief generation | 5-20/day |
| Transcript → Meeting Prep → Analysis → CRM | Post-call analysis with BANT | 5-20/day |

---

## Agent Communication Overview

This section shows the unified architecture across all three agents, demonstrating how they share infrastructure while maintaining distinct responsibilities.

```mermaid
flowchart TB
    subgraph Triggers["Entry Points"]
        CAL[/"Calendar Webhook<br/>(30 min before)"/]
        N8N[("n8n Scheduled")]
        INST_WH[/"Instantly Reply<br/>Webhook"/]
        MANUAL[/"Manual /brief<br/>Slack Command"/]
        WH_SCORE[/"Score Lead<br/>Webhook"/]
    end

    subgraph Agents["AI Agents (TypeScript/Bun)"]
        LS["Lead Scorer<br/>80k tokens<br/>:3001"]
        RH["Reply Handler<br/>60k tokens<br/>:3002"]
        MP["Meeting Prep<br/>100k tokens<br/>:3003"]
    end

    subgraph MCPLayer["MCP REST API (:8100)"]
        REST["FastAPI Wrapper"]

        subgraph Tools["MCP Tools"]
            QDRANT_T["Qdrant Tools<br/>• query_kb<br/>• get_brain<br/>• add_insight"]
            ATTIO_T["Attio Tools<br/>• find_person<br/>• update_person<br/>• create_task"]
            INST_T["Instantly Tools<br/>• get_threads<br/>• send_reply"]
        end
    end

    subgraph Data["Data Layer"]
        QDRANT[("Qdrant<br/>Vector KB<br/>:6333")]
        REDIS[("Upstash Redis<br/>Research Cache<br/>24h TTL")]
    end

    subgraph External["External Services"]
        ATTIO[("Attio CRM")]
        AIRTABLE[("Airtable")]
        SLACK["Slack<br/>Block Kit"]
        INSTANTLY["Instantly Email"]
        CLAUDE["Claude API"]
    end

    %% Trigger connections
    WH_SCORE --> LS
    N8N --> LS
    INST_WH --> RH
    CAL --> MP
    MANUAL --> MP

    %% Agent to MCP REST
    LS --> REST
    RH --> REST
    MP --> REST

    %% MCP REST to Tools
    REST --> QDRANT_T
    REST --> ATTIO_T
    REST --> INST_T

    %% Tools to Data/External
    QDRANT_T --> QDRANT
    ATTIO_T --> ATTIO
    INST_T --> INSTANTLY

    %% Direct connections
    LS --> AIRTABLE
    LS --> SLACK
    RH --> AIRTABLE
    RH --> SLACK
    MP --> SLACK
    MP --> REDIS
    MP --> CLAUDE

    %% Styling
    classDef trigger fill:#e1f5fe,stroke:#01579b
    classDef agent fill:#fff3e0,stroke:#e65100
    classDef mcp fill:#bbdefb,stroke:#1976d2
    classDef tool fill:#e8f5e9,stroke:#2e7d32
    classDef data fill:#f3e5f5,stroke:#7b1fa2
    classDef external fill:#fce4ec,stroke:#880e4f

    class CAL,N8N,INST_WH,MANUAL,WH_SCORE trigger
    class LS,RH,MP agent
    class REST mcp
    class QDRANT_T,ATTIO_T,INST_T tool
    class QDRANT,REDIS data
    class ATTIO,AIRTABLE,SLACK,INSTANTLY,CLAUDE external
```

### Agent Responsibilities Matrix

| Agent | Primary Function | Context Budget | Key Outputs |
|-------|-----------------|----------------|-------------|
| **Lead Scorer** | Score leads against ICP rules | 80k tokens | Score, tier, messaging angle |
| **Reply Handler** | Classify & respond to emails | 60k tokens | Auto-reply, approval request, escalation |
| **Meeting Prep** | Pre-call briefs & post-call analysis | 100k tokens | Slack brief, BANT score, CRM updates |

### Shared Infrastructure

All agents share:
- **MCP REST API** (:8100) - HTTP wrapper for tool access
- **Qdrant KB** - Brain-scoped knowledge base queries
- **State files** - Session checkpoints for resumability
- **Slack delivery** - Consistent Block Kit formatting

---

## Lead Scorer Flow

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant WH as Webhook/n8n
    participant LS as Lead Scorer Agent
    participant VD as Vertical Detector
    participant QDRANT as Qdrant MCP
    participant KB as Knowledge Base
    participant ATTIO as Attio MCP
    participant AT as Airtable
    participant SLACK as Slack
    participant STATE as State File

    %% Entry
    WH->>LS: POST /webhook/score-lead<br/>(X-Webhook-Secret)

    %% Auth validation
    LS->>LS: Validate webhook secret

    %% State check
    LS->>STATE: Load existing state<br/>(resume support)

    %% Vertical Detection
    LS->>VD: Detect vertical from lead data
    VD->>VD: Match industry, title keywords
    VD-->>LS: vertical: "iro"

    %% Brain Loading
    LS->>QDRANT: get_brain(vertical="iro")
    Note over QDRANT,KB: brain_id filter applied
    QDRANT->>KB: Query brains collection<br/>status="active", vertical="iro"
    KB-->>QDRANT: brain_iro_v1
    QDRANT-->>LS: Brain config + thresholds

    %% ICP Rule Query (BRAIN-SCOPED)
    LS->>QDRANT: query_icp_rules(brain_id="brain_iro_v1")
    Note over QDRANT,KB: CRITICAL: brain_id filter
    QDRANT->>KB: Search icp_rules<br/>WHERE brain_id="brain_iro_v1"
    KB-->>QDRANT: 47 ICP rules
    QDRANT-->>LS: Rules with weights

    %% CRM Enrichment (Sub-agent pattern)
    LS->>ATTIO: find_person(email)
    ATTIO-->>LS: Company enrichment data

    %% Scoring Loop
    loop For each ICP rule
        LS->>LS: Evaluate rule against lead
        LS->>LS: Calculate score contribution
        Note over LS: Check knockout rules
    end

    %% Score Calculation
    LS->>LS: Calculate total score (0-100)
    LS->>LS: Determine tier (priority/qualified/nurture/disqualified)
    LS->>LS: Select messaging angle

    %% Checkpoint
    LS->>STATE: Save checkpoint

    %% Output based on tier
    alt Tier 1 (Priority) - Score >= 70
        LS->>AT: Update lead: score, tier, angle
        LS->>AT: Set outbound_ready=true
    else Tier 2 (Qualified) - Score 50-69
        LS->>AT: Update lead: score, tier, angle
        LS->>SLACK: Send approval request<br/>(Approve/Reject/Adjust)
    else Tier 3/4 (Nurture/Disqualified)
        LS->>AT: Update lead: score, tier
    end

    %% Final state
    LS->>STATE: Mark lead processed
    LS-->>WH: Return scoring result
```

### Key Components

| Component | Responsibility |
|-----------|---------------|
| **Vertical Detector** | Analyzes lead data (industry, title, tech stack) to determine vertical |
| **Brain Loader** | Retrieves active brain config for the detected vertical |
| **ICP Rule Engine** | Evaluates lead against all brain-scoped rules |
| **Tier Calculator** | Converts raw score to tier using brain thresholds |
| **Angle Recommender** | Selects messaging angle based on top signals |

### Scoring Flow Detail

```mermaid
flowchart TD
    LEAD[/"Lead Input<br/>email, company, title, etc."/] --> DETECT

    subgraph Detection["Vertical Detection"]
        DETECT{{"Industry/Title<br/>Pattern Match"}}
        DETECT -->|"fintech + IR"| V_IRO["vertical: iro"]
        DETECT -->|"defense + gov"| V_DEF["vertical: defense"]
        DETECT -->|"no match"| V_GEN["vertical: general"]
    end

    V_IRO --> BRAIN["Load Brain<br/>brain_iro_v1"]
    V_DEF --> BRAIN
    V_GEN --> BRAIN

    BRAIN --> RULES["Query ICP Rules<br/>(brain_id scoped)"]

    subgraph Scoring["Score Calculation"]
        RULES --> EVAL["Evaluate Each Rule"]
        EVAL --> KNOCKOUT{"Knockout<br/>Rule Failed?"}
        KNOCKOUT -->|Yes| DISQ["Score: 0<br/>Tier: Disqualified"]
        KNOCKOUT -->|No| CALC["Sum weighted scores"]
        CALC --> NORM["Normalize to 0-100"]
    end

    NORM --> TIER{"Determine Tier<br/>(brain thresholds)"}
    TIER -->|"≥70"| T1["Tier 1: Priority<br/>Auto-queue outbound"]
    TIER -->|"50-69"| T2["Tier 2: Qualified<br/>Slack approval"]
    TIER -->|"30-49"| T3["Tier 3: Nurture<br/>Drip sequence"]
    TIER -->|"<30"| T4["Tier 4: Disqualified<br/>No action"]

    T1 --> ANGLE["Recommend Angle<br/>technical/roi/compliance"]
    T2 --> ANGLE
    T3 --> ANGLE

    ANGLE --> OUTPUT[/"Scoring Result<br/>score, tier, angle, breakdown"/]
```

---

## Reply Handler Flow

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant INST as Instantly
    participant RH as Reply Handler Agent
    participant PARSER as Email Parser
    participant CLASS as Classifier
    participant QDRANT as Qdrant MCP
    participant KB as Knowledge Base
    participant ROUTER as Tier Router
    participant SLACK as Slack
    participant ATTIO as Attio MCP
    participant EMAIL as Instantly MCP

    %% Entry
    INST->>RH: Reply webhook<br/>(thread_id, content, metadata)

    %% Parse email
    RH->>PARSER: Extract new content
    PARSER->>PARSER: Remove quoted text,<br/>signatures, disclaimers
    PARSER-->>RH: Clean reply text

    %% Classification
    RH->>CLASS: Classify intent
    CLASS->>CLASS: Analyze sentiment (-1 to 1)
    CLASS->>CLASS: Determine complexity
    CLASS-->>RH: Intent, sentiment, complexity

    %% KB Matching (BRAIN-SCOPED)
    alt Intent: positive_interest or question
        RH->>QDRANT: get_response_template(brain_id, intent)
        Note over QDRANT,KB: brain_id filter applied
        QDRANT->>KB: Search response_templates<br/>WHERE brain_id=X AND reply_type=Y
        KB-->>QDRANT: Matching templates
        QDRANT-->>RH: Templates with confidence
    else Intent: objection
        RH->>QDRANT: find_objection_handler(brain_id, text)
        QDRANT->>KB: Semantic search objection_handlers<br/>WHERE brain_id=X
        KB-->>QDRANT: Best handler match
        QDRANT-->>RH: Handler with confidence
    end

    %% Tier Routing
    RH->>ROUTER: Determine routing tier
    ROUTER->>ROUTER: Evaluate: confidence, sentiment,<br/>complexity, deal value

    alt Tier 1 - Auto-respond (confidence ≥ 0.85)
        RH->>RH: Fill template variables
        RH->>EMAIL: send_reply(thread_id, response)
        EMAIL-->>RH: Send confirmation
        RH->>ATTIO: add_activity(reply_sent)
    else Tier 2 - Approval (0.50 ≤ confidence < 0.85)
        RH->>RH: Generate draft response
        RH->>SLACK: Send approval request<br/>(Approve/Edit/Reject)
        Note over SLACK: 30-min timeout
        SLACK-->>RH: User action
        alt Approved
            RH->>EMAIL: send_reply(thread_id, response)
            RH->>ATTIO: add_activity(reply_sent)
        else Edited
            RH->>EMAIL: send_reply(thread_id, edited_response)
        else Rejected/Timeout
            RH->>ATTIO: add_activity(escalated)
        end
    else Tier 3 - Human Escalation
        RH->>SLACK: Send escalation alert<br/>(full context)
        RH->>ATTIO: add_activity(needs_human)
    end

    %% CRM Updates
    RH->>ATTIO: update_pipeline_stage(intent)

    %% Insight Extraction
    RH->>RH: Extract insights
    RH->>QDRANT: add_insight(brain_id, content, category)
```

### Tier Routing Logic

```mermaid
flowchart TD
    REPLY[/"Inbound Reply"/] --> PARSE["Parse & Clean"]
    PARSE --> CLASS["Classify Intent"]

    CLASS --> INTENT{"Intent Type?"}

    INTENT -->|"out_of_office<br/>bounce<br/>unsubscribe"| AUTO["Auto-Process<br/>(No human needed)"]

    INTENT -->|"positive_interest<br/>question<br/>objection"| MATCH["KB Matching<br/>(brain-scoped)"]

    MATCH --> CONF{"Match<br/>Confidence?"}

    CONF -->|"≥ 0.85"| T1_CHECK{"Sentiment ≥ 0?<br/>Complexity = simple?"}
    CONF -->|"0.50-0.84"| T2["Tier 2<br/>Draft for Approval"]
    CONF -->|"< 0.50"| T3["Tier 3<br/>Human Escalation"]

    T1_CHECK -->|Yes| T1["Tier 1<br/>Auto-Respond"]
    T1_CHECK -->|No| T2

    %% Deal value override
    MATCH --> VALUE{"Deal Value<br/>> $50k?"}
    VALUE -->|Yes| T3
    VALUE -->|No| CONF

    %% Outputs
    AUTO --> UPDATE_CRM["Update CRM Status"]
    T1 --> SEND["Send Response"]
    T2 --> SLACK_APPROVE["Slack Approval"]
    T3 --> SLACK_ESCALATE["Slack Escalation"]

    SEND --> UPDATE_CRM
    SLACK_APPROVE --> UPDATE_CRM
    SLACK_ESCALATE --> UPDATE_CRM

    UPDATE_CRM --> EXTRACT["Extract Insights"]
    EXTRACT --> DONE[/"Reply Processed"/]
```

### Intent Classification

| Intent | Description | Typical Tier |
|--------|-------------|--------------|
| `positive_interest` | Wants to learn more, schedule call | 1 |
| `question` | Asks about pricing, features, timeline | 1-2 |
| `objection` | Budget, timing, competitor concerns | 2-3 |
| `referral` | Wrong person, referring elsewhere | 1 |
| `out_of_office` | Auto-reply | Auto |
| `bounce` | Invalid email | Auto |
| `unsubscribe` | Opt out request | Auto |
| `not_interested` | Explicit rejection | Auto |
| `unclear` | Cannot determine intent | 3 |

---

## Meeting Prep Agent Flow

The Meeting Prep Agent generates pre-call briefs 30 minutes before scheduled meetings and performs post-call analysis on transcripts. It uses a modular sub-agent architecture for parallel data gathering.

### Brief Generation Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant CAL as Calendar/Manual
    participant WH as Webhook Handler
    participant MP as Meeting Prep Agent
    participant CG as Context Gatherer
    participant SUB as Sub-Agents (4x)
    participant MCP as MCP REST API
    participant CACHE as Redis Cache
    participant CLAUDE as Claude API
    participant SLACK as Slack

    %% Entry
    CAL->>WH: POST /webhook/meeting-prep/brief
    WH->>WH: Validate X-Webhook-Secret
    WH->>MP: Process meeting request

    MP->>CG: Gather context (parallel)

    par Instantly Fetcher
        CG->>MCP: POST /tools/get_email_threads
        MCP-->>CG: Email history
    and Airtable Fetcher
        CG->>MCP: POST /tools/get_lead
        MCP-->>CG: Lead profile
    and Attio Fetcher
        CG->>MCP: POST /tools/find_person
        MCP-->>CG: CRM data
    and KB Researcher
        CG->>MCP: POST /tools/query_kb
        MCP-->>CG: Objection handlers, similar deals
    end

    CG->>CACHE: Check company cache (24h TTL)
    CACHE-->>CG: Cache hit/miss

    CG-->>MP: GatheredContext

    MP->>CLAUDE: Generate brief (structured output)
    CLAUDE-->>MP: BriefContent

    MP->>SLACK: Post Block Kit message
    SLACK-->>MP: Delivery confirmation

    MP-->>WH: Success response
```

### Post-Meeting Analysis Flow

```mermaid
sequenceDiagram
    autonumber
    participant TR as Transcript Source
    participant WH as Webhook Handler
    participant TA as Transcript Analyzer
    participant CLAUDE as Claude API
    participant CRM as CRM Updater
    participant MCP as MCP REST API

    %% Entry
    TR->>WH: POST /webhook/meeting-prep/analyze
    WH->>WH: Validate X-Webhook-Secret
    WH->>TA: Analyze transcript

    TA->>CLAUDE: Extract BANT + insights
    Note over CLAUDE: Budget, Authority,<br/>Need, Timeline scoring

    CLAUDE-->>TA: MeetingAnalysis

    TA->>TA: Calculate BANT score (0-100)
    TA->>TA: Generate recommendation<br/>(proceed/nurture/disqualify)

    TA->>CRM: Update CRM records
    CRM->>MCP: POST /tools/update_person
    CRM->>MCP: POST /tools/create_task

    TA-->>WH: Analysis result
```

### Brief Content Structure

The pre-call brief includes:

| Section | Content | Source |
|---------|---------|--------|
| **Lead Summary** | Name, company, role, ICP score | Airtable, Lead Scorer |
| **Conversation History** | Recent email threads, sentiment | Instantly |
| **Company Context** | Size, industry, tech stack | Attio, Research cache |
| **Similar Deals** | Past wins with similar profiles | KB (brain-scoped) |
| **Objection Prep** | Likely concerns + handler strategies | KB (brain-scoped) |
| **Suggested Agenda** | Talking points, questions to ask | Claude-generated |

### BANT Scoring

| Dimension | Weight | Signals |
|-----------|--------|---------|
| **Budget** | 25% | Explicit budget mention, funding status, org size |
| **Authority** | 25% | Decision-maker role, buying process clarity |
| **Need** | 25% | Pain point urgency, timeline pressure, current solution gaps |
| **Timeline** | 25% | Explicit dates, urgency language, project deadlines |

### Key Components

| Component | Responsibility |
|-----------|---------------|
| **Webhook Handler** | HTTP entry point, secret validation, request routing |
| **Context Gatherer** | Parallel sub-agent orchestration, cache management |
| **Brief Generator** | Claude-powered brief synthesis from gathered context |
| **Transcript Analyzer** | BANT extraction, scoring, recommendation generation |
| **Slack Delivery** | Block Kit formatting, channel routing |
| **CRM Updater** | Attio sync after analysis |

### Error Handling

```mermaid
flowchart TD
    REQ[/"Incoming Request"/] --> VALIDATE{"Valid<br/>Secret?"}
    VALIDATE -->|No| REJECT["401 Unauthorized"]
    VALIDATE -->|Yes| GATHER["Gather Context"]

    GATHER --> CHECK{"All Sub-Agents<br/>Succeeded?"}
    CHECK -->|Yes| GENERATE["Generate Brief"]
    CHECK -->|Partial| FALLBACK["Use Available Data<br/>+ Mark Incomplete"]
    CHECK -->|Fail| RETRY{"Retry<br/>Count < 3?"}

    RETRY -->|Yes| GATHER
    RETRY -->|No| NOTIFY["Slack Error Alert"]

    FALLBACK --> GENERATE
    GENERATE --> DELIVER["Deliver to Slack"]

    DELIVER --> SUCCESS{"Delivery<br/>OK?"}
    SUCCESS -->|Yes| DONE[/"Brief Delivered"/]
    SUCCESS -->|No| NOTIFY

    NOTIFY --> DONE_ERR[/"Error Logged"/]

    classDef error fill:#ffcdd2,stroke:#b71c1c
    classDef success fill:#c8e6c9,stroke:#2e7d32
    classDef decision fill:#fff9c4,stroke:#f57f17

    class REJECT,NOTIFY,DONE_ERR error
    class DONE success
    class VALIDATE,CHECK,RETRY,SUCCESS decision
```

---

## Brain Lifecycle Flow

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant OP as GTM Operator
    participant MCP as Brain MCP Tools
    participant QDRANT as Qdrant
    participant EMBED as Voyage AI

    %% Create Brain
    OP->>MCP: create_brain(name, vertical, config)
    MCP->>QDRANT: Create brain record<br/>status="draft"
    QDRANT-->>MCP: brain_id="brain_defense_v1"
    MCP-->>OP: Brain created

    %% Seed ICP Rules
    OP->>MCP: seed_icp_rules(brain_id, rules[])
    loop For each rule
        MCP->>EMBED: Embed rule criteria
        EMBED-->>MCP: Vector
        MCP->>QDRANT: Upsert to icp_rules<br/>brain_id scoped
    end
    MCP-->>OP: 47 rules seeded

    %% Seed Templates
    OP->>MCP: seed_templates(brain_id, templates[])
    loop For each template
        MCP->>EMBED: Embed template text
        EMBED-->>MCP: Vector
        MCP->>QDRANT: Upsert to response_templates<br/>brain_id scoped
    end
    MCP-->>OP: 52 templates seeded

    %% Seed Handlers
    OP->>MCP: seed_handlers(brain_id, handlers[])
    loop For each handler
        MCP->>EMBED: Embed objection text
        EMBED-->>MCP: Vector
        MCP->>QDRANT: Upsert to objection_handlers<br/>brain_id scoped
    end
    MCP-->>OP: 23 handlers seeded

    %% Seed Research
    OP->>MCP: seed_research(brain_id, docs[])
    loop For each doc
        MCP->>EMBED: Embed content
        EMBED-->>MCP: Vector
        MCP->>QDRANT: Upsert to market_research<br/>brain_id scoped
    end
    MCP-->>OP: 156 docs seeded

    %% Activate Brain
    OP->>MCP: update_brain_status(brain_id, "active")
    MCP->>QDRANT: Find current active brain<br/>for vertical
    QDRANT-->>MCP: Previous active brain_id
    MCP->>QDRANT: Set previous brain<br/>status="archived"
    MCP->>QDRANT: Set new brain<br/>status="active"
    MCP-->>OP: Brain activated

    %% Query Stats
    OP->>MCP: get_brain_stats(brain_id)
    MCP->>QDRANT: Count items per collection
    QDRANT-->>MCP: Counts
    MCP-->>OP: Stats report
```

### Brain State Machine

```mermaid
stateDiagram-v2
    [*] --> Draft: create_brain()

    Draft --> Draft: seed_*()
    Draft --> Active: update_status("active")

    Active --> Active: seed_*()<br/>(add content)
    Active --> Archived: new brain activated<br/>for same vertical

    Archived --> Active: update_status("active")
    Archived --> [*]: delete_brain()

    Draft --> [*]: delete_brain()

    note right of Active
        Only ONE active brain
        per vertical at any time
    end note

    note right of Draft
        Seeding allowed
        Not queryable by agents
    end note
```

### Brain Collections Structure

```mermaid
erDiagram
    BRAIN ||--o{ ICP_RULE : contains
    BRAIN ||--o{ RESPONSE_TEMPLATE : contains
    BRAIN ||--o{ OBJECTION_HANDLER : contains
    BRAIN ||--o{ MARKET_RESEARCH : contains
    BRAIN ||--o{ INSIGHT : learns

    BRAIN {
        string brain_id PK
        string name
        string vertical
        string status
        json config
        json stats
    }

    ICP_RULE {
        string id PK
        string brain_id FK
        string category
        string attribute
        json condition
        int score_weight
        bool is_knockout
    }

    RESPONSE_TEMPLATE {
        string id PK
        string brain_id FK
        string reply_type
        int tier
        string template_text
        json variables
    }

    OBJECTION_HANDLER {
        string id PK
        string brain_id FK
        string objection_type
        string handler_strategy
        string handler_response
    }

    MARKET_RESEARCH {
        string id PK
        string brain_id FK
        string content_type
        string title
        string content
        json key_facts
    }

    INSIGHT {
        string id PK
        string brain_id FK
        string category
        string content
        json source
        float confidence
    }
```

---

## Component Architecture

### System Components

```mermaid
flowchart TB
    subgraph External["External Services"]
        AIRTABLE[("Airtable<br/>Lead Database")]
        ATTIO[("Attio CRM")]
        SLACK["Slack"]
        INSTANTLY["Instantly Email"]
        VOYAGE["Voyage AI<br/>Embeddings"]
        CLAUDE["Claude API"]
    end

    subgraph Infrastructure["Infrastructure (Docker)"]
        subgraph DataLayer["Data Layer"]
            QDRANT[("Qdrant<br/>:6333")]
            POSTGRES[("PostgreSQL<br/>n8n metadata")]
            REDIS[("Upstash Redis<br/>Research Cache")]
        end

        subgraph MCPLayer["MCP Layer"]
            MCP_REST["MCP REST API<br/>:8100"]
            subgraph MCPServers["MCP Servers (Python FastMCP)"]
                QDRANT_MCP["Qdrant MCP"]
                ATTIO_MCP["Attio MCP"]
                INSTANTLY_MCP["Instantly MCP"]
            end
        end

        subgraph Orchestration["Workflow Orchestration"]
            N8N["n8n<br/>Scheduled triggers,<br/>complex workflows"]
        end
    end

    subgraph Application["Application Layer (TypeScript/Bun)"]
        subgraph Agents["AI Agents"]
            LEAD_SCORER["Lead Scorer<br/>80k context<br/>:3001"]
            REPLY_HANDLER["Reply Handler<br/>60k context<br/>:3002"]
            MEETING_PREP["Meeting Prep<br/>100k context<br/>:3003"]
        end

        subgraph Lib["Shared Libraries"]
            TYPES["types.ts<br/>Branded types"]
            QDRANT_CLIENT["qdrant.ts<br/>Client wrapper"]
            STATE["state.ts<br/>State management"]
            EMBEDDINGS["embeddings.ts<br/>Voyage wrapper"]
        end
    end

    subgraph StateFiles["State Persistence"]
        LS_STATE[/"lead-scorer-state.json"/]
        RH_STATE[/"reply-handler-state.json"/]
        MP_STATE[/"meeting-prep-state.json"/]
    end

    %% Connections
    Agents --> Lib
    Agents --> MCP_REST
    MCP_REST --> MCPServers
    Agents --> StateFiles
    MCPServers --> DataLayer
    MCPServers --> External
    Orchestration --> Agents
    QDRANT_MCP --> VOYAGE
    MEETING_PREP --> REDIS
    MEETING_PREP --> CLAUDE

    classDef external fill:#fce4ec,stroke:#880e4f
    classDef infra fill:#e8f5e9,stroke:#2e7d32
    classDef app fill:#fff3e0,stroke:#e65100
    classDef state fill:#fffde7,stroke:#f57f17
    classDef rest fill:#bbdefb,stroke:#1976d2

    class AIRTABLE,ATTIO,SLACK,INSTANTLY,VOYAGE,CLAUDE external
    class QDRANT,POSTGRES,REDIS,QDRANT_MCP,ATTIO_MCP,INSTANTLY_MCP,N8N infra
    class MCP_REST rest
    class LEAD_SCORER,REPLY_HANDLER,MEETING_PREP,TYPES,QDRANT_CLIENT,STATE,EMBEDDINGS app
    class LS_STATE,RH_STATE,MP_STATE state
```

### MCP Server Topology

> **Decision**: Custom MCP servers over Composio - see [ADR-002](../adr/002-composio-mcp-decision.md)

```mermaid
flowchart LR
    subgraph Agents["AI Agents (TypeScript/Bun)"]
        LS["Lead Scorer<br/>:3001"]
        RH["Reply Handler<br/>:3002"]
        MP["Meeting Prep<br/>:3003"]
    end

    subgraph REST["MCP REST API Layer"]
        API["FastAPI Wrapper<br/>:8100"]
    end

    subgraph Custom["Custom Build (VPS - Python FastMCP)"]
        QD_MCP["Qdrant MCP"]
        ATTIO_MCP["Attio MCP"]
        INST_MCP["Instantly MCP"]
        SLACK_MCP["Slack MCP"]
        LI_MCP["LinkedIn MCP"]
    end

    subgraph DirectSDK["Direct SDK (TypeScript)"]
        SLACK_SDK["@slack/web-api<br/>(Block Kit delivery)"]
    end

    subgraph N8N_INT["n8n Integrations (nodes)"]
        AT_N8N["Airtable Node"]
        GC_N8N["Google Calendar Node"]
        GM_N8N["Gmail Node"]
    end

    subgraph N8N_MCP["n8n as MCP Server"]
        WF_MCP["Complex Workflows<br/>as Tools"]
    end

    Agents --> API
    Agents --> DirectSDK
    Agents --> N8N_MCP
    API --> Custom

    QD_MCP --> QDRANT[("Qdrant")]
    ATTIO_MCP --> ATTIO[("Attio CRM")]
    INST_MCP --> INSTANTLY["Instantly"]
    SLACK_MCP --> SLACK["Slack API"]
    SLACK_SDK --> SLACK
    LI_MCP --> AIMFOX["Aimfox"]
```

---

## Glossary

| Term | Definition |
|------|------------|
| **BANT** | Budget, Authority, Need, Timeline - framework for qualifying sales leads. Meeting Prep Agent extracts and scores these dimensions. |
| **Brain** | A vertical-specific knowledge base containing ICP rules, templates, handlers, and research. The "swappable" component that gives agents domain expertise. |
| **brain_id** | Unique identifier for a brain (format: `brain_{vertical}_{timestamp}`). MUST be included in all KB queries. |
| **Brief** | Pre-call preparation document generated by Meeting Prep Agent, delivered via Slack Block Kit. |
| **Context Gatherer** | Component that orchestrates parallel sub-agent calls to collect meeting context from multiple sources. |
| **ICP Rule** | Ideal Customer Profile scoring criterion defining an attribute, condition, and score weight. |
| **Insight** | Learning extracted from conversations, stored in KB with quality gates. |
| **Knockout Rule** | An ICP rule that, if failed, immediately disqualifies a lead (score = 0). |
| **MCP** | Model Context Protocol - standard for AI agents to interact with external tools. |
| **MCP REST API** | HTTP wrapper (:8100) that enables TypeScript agents to call Python MCP tools via REST endpoints. |
| **Brain-Scoped Query** | A query to Qdrant that includes `brain_id` filter to ensure vertical-specific results. |
| **State File** | JSON file (`state/*.json`) storing session checkpoints for resumable operations. |
| **Sub-Agent** | Pattern where main agent spawns isolated agent for data gathering (returns distilled results). |
| **Tier** | Routing classification: Tier 1 (auto-action), Tier 2 (approval needed), Tier 3 (human only). |
| **Transcript Analyzer** | Component that extracts BANT signals and generates recommendations from meeting transcripts. |
| **Vertical** | A market segment (e.g., "iro" = Investor Relations Operations, "defense" = Defense Contractors). |

---

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-20 | 1.1 | Added Meeting Prep Agent flow, Agent Communication Overview, updated status tables, MCP REST API layer | Atlas GTM Team |
| 2026-01-20 | 1.0 | Initial data flow documentation with status markers | Atlas GTM Team |

---

## Maintenance Instructions

> **For Claude Code**: Follow these instructions when implementing features that affect data flow.

### When to Update This Document

1. **New agent implemented** → Add sequence diagram, update status table
2. **New MCP server added** → Update component diagram, add to MCP topology
3. **New integration point** → Update overview flow diagram
4. **Data flow changes** → Update relevant sequence diagrams

### How to Update

1. Read this document fully before making changes
2. Update the **Implementation Status** tables (top of doc)
3. Update relevant diagrams if data flow changed
4. Add entry to **Change Log** with date and description
5. Update `CLAUDE.md` status summary if component status changed

### Status Markers

- `✅` - Feature is implemented and merged to main
- `🚧` - Feature is in active development (has a branch)
- `📋` - Feature is planned but not started

---

## Next Steps

- [ ] Review with GTM expert
- [x] Add Meeting Prep agent flow ✅
- [x] Add error handling paths (Meeting Prep has retry/fallback documented) ✅
- [ ] Add monitoring/observability touchpoints
- [ ] Document retry/fallback patterns for Lead Scorer and Reply Handler

---

*For implementation details, see the specs in `/specs/` directory.*
