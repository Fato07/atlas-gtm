# GTM Operations System Roadmap
## 8-Week Implementation Plan

---

## Overview

**Goal**: Build AI-first GTM system that handles 80% of outbound sales operations automatically.

**Timeline**: 8 weeks
**Monthly Cost**: $255-410 (includes observability + evaluation)
**Weekly Time Saved (Target)**: 15+ hours

### New Operational Layers (Integrated)

| Layer | Tool | Purpose | Week |
|-------|------|---------|------|
| **Observability** | Langfuse | Trace agent calls, token usage, quality scoring | 3-4 |
| **Evaluation** | Ragas | RAG retrieval quality metrics | 5-6 |
| **Security** | Lakera Guard | Prompt injection & PII detection | 7-8 |

---

## Week-by-Week Plan

```
Week 1: Foundation          ████████░░░░░░░░  Infrastructure + KB setup
Week 2: Lead Scorer         ████████████░░░░  First agent live
Week 3: Langfuse ★          ████████████████  Observability layer + Reply Handler start
Week 4: Reply Handler       ████████████████  Core automation + Langfuse complete
Week 5: Ragas ★             ████████████░░░░  RAG evaluation + Meeting Prep
Week 6: Meeting Prep        ████████████░░░░  Pre-call briefs + Ragas complete
Week 7: Lakera Guard ★      ████████████░░░░  Security layer + Learning Loop
Week 8: Multi-Vertical      ████████░░░░░░░░  Second brain + Security complete
```

> ★ **New Operational Layers**: Langfuse (observability), Ragas (evaluation), and Lakera Guard (security) are integrated into existing weekly work without extending timeline.

> **UI Decision**: Building a full control panel (dashboard + KB management + approval queue) using Retool for quick MVP. Custom Next.js UI planned for Phase 2 if productizing. See `specs/frontend-ui.md` for details.

---

## Week 1: Foundation

### Goal
Infrastructure deployed, Knowledge Base seeded with IRO brain, first MCP connections working.

### You Do

| Day | Task | Time | Output |
|-----|------|------|--------|
| Mon | Get API keys (Airtable, Attio, Instantly, Slack) | 1h | All keys ready |
| Mon | Choose LinkedIn tool (Heyreach/GojiRyte/Aimfox) | 30m | Decision made |
| Tue | Write ICP criteria document | 2h | 1-page ICP doc |
| Tue | Export 100 leads with manual scores | 1h | Labeled dataset |
| Wed | Run 10 research prompts for IRO | 2h | Raw research output |
| Thu | Write 10 response templates | 2h | Template drafts |
| Thu | Write 10 objection handlers | 1h | Handler drafts |
| Fri | Review seed data, provide feedback | 1h | Approved seed content |

**Total You Time**: ~11 hours

### Engineer Does

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Deploy VPS, Docker setup | VPS running |
| Mon | Deploy Qdrant, n8n, Postgres | Infrastructure live |
| Tue | Create Qdrant collections | Schema implemented |
| Tue | Integrate Voyage AI embeddings | Embedding pipeline |
| Wed | Build Qdrant MCP server | MCP responding |
| Wed | Build custom Slack MCP + n8n Airtable | MCPs connected |
| Thu | Seed KB with IRO brain content | Brain populated |
| Fri | Test queries, fix issues | E2E query working |

### Success Criteria

```
✓ VPS running with Docker stack
✓ Qdrant has IRO brain with:
  - 30+ ICP rules
  - 10+ templates
  - 10+ handlers
  - 20+ research docs
✓ Can query KB via MCP and get relevant results
✓ Custom Slack MCP + n8n Airtable node (Composio rejected - ADR-002)
✓ n8n can call MCPs
```

---

## Week 2: Lead Scorer Agent

### Goal
Lead Scorer agent scoring leads from Airtable with >90% accuracy.

### You Do

| Day | Task | Time | Output |
|-----|------|------|--------|
| Mon | Review scoring logic, adjust rules | 1h | Approved rules |
| Tue | Score 20 leads manually (baseline) | 2h | Comparison dataset |
| Wed | Review AI's scoring of same 20 | 1h | Accuracy check |
| Thu | Provide feedback on mismatches | 1h | Tuning notes |
| Fri | Approve for production | 30m | Go/no-go decision |

**Total You Time**: ~6 hours

### Engineer Does

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Build Lead Scorer agent logic | Core agent |
| Mon | Create Claude prompts for scoring | Prompts tested |
| Tue | Build n8n workflow (trigger + route) | Workflow draft |
| Wed | Connect Airtable read/write | CRUD working |
| Wed | Run against 20 test leads | Test results |
| Thu | Tune based on feedback | Improved accuracy |
| Thu | Add Slack notification for Tier 2 | Notifications |
| Fri | Deploy to production | Agent live |

### Success Criteria

```
✓ Lead Scorer agent deployed
✓ Accuracy > 90% vs manual scoring
✓ Processing latency < 2 seconds/lead
✓ Tier 1/2/3 routing working
✓ Slack notifications for Tier 2
✓ Airtable updated with scores
```

---

## Week 3: Langfuse Observability + Reply Handler Start

### Goal
Observability layer operational, Reply Handler development started.

### You Do

| Day | Task | Time | Output |
|-----|------|------|--------|
| Mon | Label 50 past replies (intent, tier) | 3h | Labeled dataset |
| Tue | Review Langfuse dashboard setup | 30m | Dashboard validated |
| Wed | Test approval flow in Slack | 1h | Flow validated |
| Thu | Review auto-responses, provide feedback | 2h | Approved templates |
| Fri | Review observability traces | 30m | Trace quality check |

**Total You Time**: ~7 hours

### Engineer Does

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | ★ Add Langfuse to `packages/lib` | Observability module |
| Mon | ★ Wrap Lead Scorer with traces | Agent instrumented |
| Tue | ★ Add LLM generation tracking | Token/cost tracking |
| Tue | Build Instantly webhook receiver | Webhook working |
| Wed | Build reply classification logic | Classifier |
| Wed | ★ Add custom quality scores | Accuracy/quality metrics |
| Thu | Build KB matching (templates/handlers) | Matcher |
| Fri | Test on 50 labeled replies | Accuracy results |

### Success Criteria

```
✓ Langfuse observability module deployed
✓ Lead Scorer traces visible in Langfuse
✓ Token usage tracked per LLM call
✓ Custom quality scores implemented (accuracy, tier, vertical)
✓ Reply Handler classification logic working
✓ 50 replies tested for accuracy
```

---

## Week 4: Reply Handler + Langfuse Complete

### Goal
Reply Handler deployed with full observability coverage.

### You Do

| Day | Task | Time | Output |
|-----|------|------|--------|
| Mon | Review classification accuracy | 1h | Accuracy report |
| Tue | Test Slack approval flow | 1h | Flow validated |
| Wed | Review auto-responses | 2h | Approved templates |
| Thu | Review Langfuse cost reports | 30m | Cost baseline |
| Fri | Approve for auto-response | 30m | Go/no-go |

**Total You Time**: ~5 hours

### Engineer Does

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Build Slack approval flow | Buttons working |
| Mon | Build response generation | Generator |
| Tue | Connect to Instantly send | Auto-reply working |
| Tue | ★ Instrument Reply Handler with traces | Full coverage |
| Wed | Build Attio CRM updates | CRM sync |
| Thu | Deploy Reply Handler | Agent live |
| Fri | ★ Langfuse dashboard finalization | Observability complete |

### Success Criteria

```
✓ Reply Handler agent deployed
✓ Classification accuracy > 85%
✓ Tier 1 auto-responding (simple positives, OOO, unsub)
✓ Tier 2 drafts appearing in Slack
✓ Slack approval buttons working
✓ Attio records created for engaged leads
★ 100% agent traces in Langfuse
★ Token usage dashboard operational
★ Quality scores recorded for all outputs
```

---

## Week 5: Ragas RAG Evaluation + Meeting Prep

### Goal
RAG evaluation framework operational, Meeting Prep agent started.

### You Do

| Day | Task | Time | Output |
|-----|------|------|--------|
| Mon | Connect Google Calendar | 30m | Calendar linked |
| Mon | Set up Fireflies (optional) | 30m | Transcription ready |
| Tue | Book 3 test meetings | 30m | Test appointments |
| Wed | Review generated briefs | 2h | Brief feedback |
| Thu | ★ Create golden test cases (10 per collection) | 2h | Initial golden datasets |
| Fri | Review Ragas evaluation results | 30m | Quality metrics review |

**Total You Time**: ~6 hours

### Engineer Does

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | ★ Add Ragas dependencies to MCP | Evaluation module |
| Mon | ★ Create evaluation module structure | `mcp-servers/evaluation/` |
| Tue | ★ Implement QdrantRAGEvaluator | Evaluation working |
| Tue | Build Calendar trigger | 30-min trigger |
| Wed | Build brief generation prompt | Brief template |
| Wed | ★ Create initial golden datasets | Test cases |
| Thu | Send brief to Slack | Delivery working |
| Fri | ★ Run first Ragas evaluation | Baseline metrics |

### Success Criteria

```
✓ Ragas evaluation module deployed
✓ Golden datasets for all collections (10+ test cases each)
✓ Context Precision >= 0.80 baseline
✓ Context Recall >= 0.75 baseline
✓ Calendar trigger working
✓ Brief generation prompt tested
```

---

## Week 6: Meeting Prep Complete + Ragas CI/CD

### Goal
Meeting Prep agent deployed, Ragas integrated into CI/CD.

### You Do

| Day | Task | Time | Output |
|-----|------|------|--------|
| Mon | Provide post-meeting notes | 1h | Test analysis input |
| Tue | Review analysis output | 1h | Quality check |
| Wed | ★ Expand golden datasets | 50+ test cases |
| Thu | Review Ragas dashboard | 30m | Quality trends |
| Fri | Approve Meeting Prep | 30m | Go/no-go |

**Total You Time**: ~4 hours

### Engineer Does

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Build post-meeting analysis | Analyzer |
| Tue | Connect to Attio updates | CRM sync |
| Tue | Build insight extraction | Learning capture |
| Wed | ★ Implement LangfuseReporter | Metrics in dashboard |
| Thu | ★ Create GitHub Actions workflow | CI/CD integration |
| Thu | Deploy Meeting Prep | Agent live |
| Fri | ★ Finalize Ragas evaluation | Evaluation complete |

### Success Criteria

```
✓ Pre-call briefs generating 30 min before
✓ Brief includes: context, history, talking points
✓ Post-meeting analysis extracting insights
✓ Attio updated with meeting notes
★ Context Precision >= 0.80
★ Context Recall >= 0.75
★ Ragas CI/CD pipeline passing
★ Golden datasets: 50+ test cases per collection
```

---

## Week 7: Lakera Guard Security + Learning Loop

### Goal
Security layer operational, Learning Loop deployed.

### You Do

| Day | Task | Time | Output |
|-----|------|------|--------|
| Mon | Review pending insights (validation queue) | 1h | Validated insights |
| Tue | Check KB for insight quality | 1h | Quality report |
| Wed | ★ Review security audit logs | 30m | Security check |
| Thu | Add manual insights from calls | 2h | Human knowledge |
| Fri | Run first weekly synthesis report | 30m | Report review |

**Total You Time**: ~5 hours

### Engineer Does

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | ★ Create `packages/lib/src/security/` module | Security module |
| Mon | ★ Implement LakeraGuardClient | Guard client |
| Tue | ★ Create SecurityMiddleware | Middleware wrapper |
| Tue | Build insight extraction pipeline | Extractor |
| Wed | ★ Integrate into angles.ts (Claude calls) | Prompts secured |
| Wed | Implement quality gates | Dedup, confidence |
| Thu | ★ Integrate into webhook.ts (input) | Inputs screened |
| Thu | Build validation queue (Slack) | Approval flow |
| Fri | ★ Implement security audit logging | Audit trail |

### Success Criteria

```
✓ Lakera Guard security module deployed
✓ Prompt injection detection active
✓ PII masking before LLM calls
✓ Security audit logs operational
✓ Insights auto-extracted from conversations
✓ Quality gates filtering noise
✓ Validation queue in Slack working
★ 100% prompt injection detection
★ 100% PII masked before LLM
★ <50ms security screening latency
```

---

## Week 8: Multi-Vertical + Security Complete

### Goal
Second vertical brain seeded, security layer finalized, all operational layers complete.

### You Do

| Day | Task | Time | Output |
|-----|------|------|--------|
| Mon | Choose second vertical (Defense?) | 30m | Decision |
| Tue | Run research prompts for V2 | 3h | V2 research |
| Wed | Write V2 ICP rules | 2h | V2 rules |
| Thu | Write V2 templates/handlers | 2h | V2 content |
| Fri | ★ Final review of all operational layers | 1h | Full system check |

**Total You Time**: ~9 hours

### Engineer Does

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Build brain creation workflow | Brain seeder |
| Mon | ★ Complete security testing | Security validated |
| Tue | Seed V2 brain | V2 in Qdrant |
| Wed | Test brain-swapping mechanism | Swap working |
| Thu | Run 100 leads through V2 | V2 scores |
| Thu | ★ Security + observability documentation | Runbooks |
| Fri | Compare V1 vs V2 performance | Final report |

### Success Criteria

```
✓ Second brain (Defense/Healthcare) created
✓ Brain-swapping working via Slack command
✓ 100 leads scored with V2 brain
✓ Can switch between V1 and V2 seamlessly
★ All operational layers complete:
  - Langfuse: 100% agent traces, token/cost tracking
  - Ragas: CI/CD passing, metrics >= thresholds
  - Lakera: 100% injection detection, PII masking
★ Security runbook documented
★ Ready for production scale
```

---

## Timeline Summary

| Week | Focus | Key Deliverable | New Layer | You Time |
|------|-------|-----------------|-----------|----------|
| 1 | Foundation | KB seeded, infra live | - | 11h |
| 2 | Lead Scorer | First agent live | - | 6h |
| 3 | Langfuse ★ | Observability + Reply start | Langfuse | 7h |
| 4 | Reply Handler | Auto-responding + Langfuse done | - | 5h |
| 5 | Ragas ★ | RAG evaluation + Meeting start | Ragas | 6h |
| 6 | Meeting Prep | Pre-call briefs + Ragas done | - | 4h |
| 7 | Lakera Guard ★ | Security + Learning Loop | Lakera Guard | 5h |
| 8 | Multi-Vertical | Second brain + all layers done | - | 9h |

**Total Your Time**: ~53 hours over 8 weeks (~6.6h/week)

> ★ New operational layers integrated without extending timeline

---

## Risk Mitigation

### Technical Risks

| Risk | Mitigation | Fallback |
|------|------------|----------|
| Qdrant performance issues | Pre-test with expected load | Use Qdrant Cloud |
| MCP complexity | Custom FastMCP servers (ADR-002) | n8n nodes for simple CRUD |
| Claude accuracy | Extensive prompt testing | Human review for edge cases |
| Instantly webhook delays | Implement retry logic | Poll as backup |
| Langfuse latency impact | Async tracing, batch flush | Disable in hot path |
| Ragas evaluator cost | Use gpt-4o-mini, limit runs | Weekly runs only |
| Lakera API unavailable | Fail-open with logging | Skip security check |
| Free tier exceeded | Monitor usage, upgrade path | Budget for paid tier |

### Business Risks

| Risk | Mitigation | Fallback |
|------|------------|----------|
| Low reply rates | A/B test messaging quickly | Iterate weekly |
| Poor lead quality | Tune ICP rules aggressively | Manual review first batch |
| Tool integration issues | Have backup tools identified | Manual process short-term |

---

## Budget Summary

### One-Time Setup
- Engineer time: 75-90 hours (includes operational layers)

### Monthly Recurring

| Item | Cost | Notes |
|------|------|-------|
| VPS (n8n, Qdrant) | $50 | |
| Claude API | $30-50 | |
| Voyage AI | $5 | |
| Airtable | $20 | |
| Attio | $29 | |
| Instantly | $37-97 | |
| LinkedIn tool | $50-100 | |
| ~~Composio~~ | ~~$0-20~~ | Rejected (ADR-002) - using custom MCPs |
| **Langfuse** ★ | **$0** | Free tier (50k observations/mo) |
| **OpenAI (Ragas)** ★ | **$5-10** | Evaluator LLM (gpt-4o-mini) |
| **Lakera Guard** ★ | **$0** | Free tier (10k requests/mo) |
| **Total** | **$255-410** | +$5-10 vs. original |

### Free Tier Coverage

| Service | Free Tier Limit | Estimated Usage | Headroom |
|---------|-----------------|-----------------|----------|
| Langfuse | 50k observations/mo | ~6k/mo | ~8x buffer |
| Lakera Guard | 10k requests/mo | ~2-5k/mo | ~2-5x buffer |

> ★ **Scale consideration**: If exceeding free tiers, Langfuse Hobby $59/mo, Lakera Enterprise (quote needed)

---

## Communication Plan

### Daily
- Slack check-in: Quick async update on progress/blockers

### Twice Weekly
- **Wednesday**: 30-min sync - mid-week check, debug issues
- **Friday**: 30-min sync - week review, plan next week

### Weekly Output
- Demo of new capabilities
- Metrics review
- Next week priorities

### Artifacts
- **Slack channel**: `#gtm-ops-system`
- **GitHub repo**: Code + documentation
- **Notion**: Knowledge Base content drafts
- **Shared sheet**: Performance tracking

---

## Success Metrics by Week 8

```
OPERATIONAL:
✓ 80% of replies auto-handled (Tier 1 + Tier 2 approved)
✓ <5 min average response time to replies
✓ Pre-call briefs for 100% of meetings
✓ Zero manual CRM data entry

PERFORMANCE:
✓ Lead scoring accuracy > 90%
✓ Reply classification accuracy > 85%
✓ KB match confidence > 80%

★ OBSERVABILITY (Langfuse):
✓ 100% agent traces captured
✓ Token usage tracked per agent/operation
✓ Quality scores for all LLM outputs
✓ Cost tracking per vertical

★ EVALUATION (Ragas):
✓ Context Precision >= 0.80
✓ Context Recall >= 0.75
✓ Faithfulness >= 0.85
✓ CI/CD quality gates passing
✓ Golden datasets: 50+ test cases per collection

★ SECURITY (Lakera Guard):
✓ 100% prompt injection detection
✓ 100% PII masking before LLM calls
✓ Security audit trail complete
✓ <50ms security screening latency

TIME SAVINGS:
✓ 15+ hours/week saved vs manual process
✓ 4-5 hours/week your time (down from 20+)

LEARNING:
✓ 100+ insights captured in KB
✓ Weekly synthesis reports generating
✓ Template performance tracked
```

---

## Post-Week 8: What's Next

### Phase 2 Options

1. **Scale**: Run 10,000+ leads through proven system
2. **Multi-Vertical**: Add 2-3 more verticals
3. **Custom UI**: Replace Retool with Next.js + shadcn/ui for productization
4. **Voice**: Add voice agent for qualification calls
5. **Nurture**: Build content engine from KB insights
6. **Productize**: Package for agency clients ($2-3k setup + $500/mo maintenance)

### Technical Improvements

1. **Custom Next.js UI** - If productizing, replace Retool with branded control panel
2. Add Neo4j for complex graph queries
2. Fine-tune embeddings on your data
3. Build custom UI dashboard
4. Implement advanced A/B testing
5. Add predictive lead scoring

---

*This roadmap is a living document. Update weekly based on learnings.*
