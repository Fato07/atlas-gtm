┌─────────────────────────────────────────────────────────────┐
│                     Atlas GTM System                        │
├─────────────────────────────────────────────────────────────┤
│  Communication: MCP (FastMCP)                               │
├─────────────────────────────────────────────────────────────┤
│  Memory: Qdrant (KB) + Upstash (State) + [Mem0?]           │
├─────────────────────────────────────────────────────────────┤
│  Security: [Lakera Guard] ← NEW                             │
├─────────────────────────────────────────────────────────────┤
│  Orchestration: Custom TypeScript Agents                    │
├─────────────────────────────────────────────────────────────┤
│  Observability: [Langfuse] ← NEW                            │
├─────────────────────────────────────────────────────────────┤
│  Evaluation: [Ragas + Custom Evals] ← NEW                   │
├─────────────────────────────────────────────────────────────┤
│  Data Storage: Qdrant + Upstash Redis                       │
├─────────────────────────────────────────────────────────────┤
│  Foundation Model: Anthropic Claude                         │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure: Docker / Serverless                        │
└─────────────────────────────────────────────────────────────┘

create a plan to update the architecture docs, roadmap and the project to include these layers

  Langfuse - Observability + basic evals (Week 3-4)
  - Trace all agent calls
  - Track token usage, latency, errors
  - Score outputs for quality

  Ragas - RAG evaluation (Week 5-6)
  - Measure retrieval quality from Qdrant
  - Ensure brain queries return relevant results

  Lakera Guard - Security (Week 7-8)
  - Prompt injection detection
  - PII detection before sending to LLM


Security Layer (Lakera Guard) at the top of the stack
Observability Layer (Langfuse) around agent calls
Evaluation Layer (Ragas) for RAG quality
Full stack layers table mapping to the agentic system diagram
Integration code examples for each tool
Update data flow diagrams with ★ markers for new layers


Week 3: Langfuse integration milestone
Week 4: Lakera Guard integration milestone
Week 6: Ragas evaluation pipeline
Update the budget accordingly and reasssess and update the milestones as you think deemed fit!
New success metrics for observability, evaluation, security
