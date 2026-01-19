# RAG Evaluation System - Data Flow & Execution Analysis

## Overview

This document provides a surgical analysis of the RAG evaluation system in Atlas GTM, including data flow, execution flow, and code architecture using Mermaid diagrams.

---

## 1. High-Level Architecture

```mermaid
graph TB
    subgraph "Entry Layer"
        CLI[CLI - cli.py]
    end

    subgraph "Orchestration Layer"
        CE[CollectionEvaluator]
        EC[EvaluationConfig]
    end

    subgraph "Evaluation Layer"
        QE[QdrantRAGEvaluator]
        RAGAS[Ragas Metrics Engine]
    end

    subgraph "Data Layer"
        GD[Golden Datasets<br/>JSON Files]
        QDB[(Qdrant<br/>Vector DB)]
    end

    subgraph "External Services"
        VAI[Voyage AI<br/>Embeddings]
        OAI[OpenAI<br/>GPT-4o-mini]
    end

    subgraph "Reporting Layer"
        JR[JSONReporter]
        LR[LangfuseReporter]
    end

    CLI --> EC
    CLI --> CE
    CE --> QE
    CE --> GD
    QE --> QDB
    QE --> VAI
    QE --> RAGAS
    RAGAS --> OAI
    CE --> JR
    CE --> LR
```

---

## 2. Execution Flow (Sequence Diagram)

```mermaid
sequenceDiagram
    participant User
    participant CLI as cli.py
    participant CE as CollectionEvaluator
    participant QE as QdrantRAGEvaluator
    participant GD as Golden Dataset
    participant Qdrant as Qdrant DB
    participant Voyage as Voyage AI
    participant Ragas as Ragas Engine
    participant OpenAI as OpenAI API
    participant Reporter as Reporters

    User->>CLI: python -m evaluation.cli evaluate
    CLI->>CLI: parse_args()
    CLI->>CLI: create EvaluationConfig

    CLI->>CE: evaluate_collections(config, collections, brain_id)
    CE->>CE: __init__(config) - creates QdrantRAGEvaluator

    loop For each collection
        CE->>GD: load_golden_dataset(path)
        GD-->>CE: GoldenDataset{test_cases}

        CE->>QE: evaluate_collection(name, dataset, brain_id)

        loop For each test_case
            QE->>Voyage: _get_embedding(question)
            Voyage-->>QE: vector[1024]

            QE->>Qdrant: query_points(collection, vector, filter)
            Note over QE,Qdrant: Filter: brain_id=X
            Qdrant-->>QE: ScoredPoint[]{payload}

            QE->>QE: extract contexts from payloads
        end

        QE->>QE: Build Dataset{questions, contexts, ground_truths, answers}

        QE->>Ragas: evaluate(dataset, metrics)
        Ragas->>OpenAI: LLM calls for metrics
        OpenAI-->>Ragas: Metric scores
        Ragas-->>QE: {precision, recall, faithfulness, relevancy}

        QE->>QE: safe_float() extraction
        QE->>QE: passes_thresholds(metrics, thresholds)
        QE-->>CE: EvaluationResult
    end

    CE->>CE: aggregate results
    CE-->>CLI: AggregatedResults

    CLI->>Reporter: print_summary(results)
    CLI->>Reporter: save_report(results)
    opt --langfuse flag
        CLI->>Reporter: report_aggregated(results)
    end

    CLI-->>User: Exit code (0 or 1)
```

---

## 3. Data Flow Diagram

```mermaid
flowchart TD
    subgraph Input["1. Input Data"]
        JSON["Golden Dataset JSON<br/>───────────────<br/>collection_name: str<br/>test_cases: list"]
        TC["GoldenTestCase<br/>───────────────<br/>id: str<br/>question: str<br/>expected_contexts: list<br/>ground_truth: str<br/>brain_id: str"]
    end

    subgraph Processing["2. Processing"]
        EMB["Embedding<br/>───────────────<br/>question → vector[1024]"]
        QRY["Qdrant Query<br/>───────────────<br/>query: vector<br/>filter: brain_id<br/>limit: 5"]
        CTX["Retrieved Contexts<br/>───────────────<br/>list[str] from payloads"]
    end

    subgraph RagasDS["3. Ragas Dataset"]
        DS["Dataset.from_dict()<br/>───────────────<br/>question: list[str]<br/>contexts: list[list[str]]<br/>ground_truth: list[str]<br/>answer: list[str]"]
    end

    subgraph Metrics["4. Metric Evaluation"]
        CP["ContextPrecision<br/>LLM-judged"]
        CR["ContextRecall<br/>LLM-judged"]
        FF["Faithfulness<br/>LLM-judged"]
        AR["AnswerRelevancy<br/>LLM+Embeddings"]
    end

    subgraph Output["5. Output Data"]
        EM["EvaluationMetrics<br/>───────────────<br/>context_precision: float<br/>context_recall: float<br/>faithfulness: float<br/>answer_relevancy: float"]
        ER["EvaluationResult<br/>───────────────<br/>collection_name: str<br/>metrics: EvaluationMetrics<br/>test_cases_evaluated: int<br/>passed: bool<br/>failures: list[str]"]
        AR2["AggregatedResults<br/>───────────────<br/>collection_results: list<br/>total_test_cases: int<br/>overall_passed: bool<br/>collections_passed: int"]
    end

    JSON --> TC
    TC --> EMB
    EMB --> QRY
    QRY --> CTX
    TC --> DS
    CTX --> DS
    DS --> CP
    DS --> CR
    DS --> FF
    DS --> AR
    CP --> EM
    CR --> EM
    FF --> EM
    AR --> EM
    EM --> ER
    ER --> AR2
```

---

## 4. Component Class Diagram

```mermaid
classDiagram
    class EvaluationConfig {
        +qdrant_url: str
        +qdrant_api_key: str
        +openai_api_key: str
        +voyage_api_key: str
        +evaluator_model: str
        +max_samples: int
        +get_collection_config(name) CollectionConfig
    }

    class MetricThresholds {
        +context_precision: float
        +context_recall: float
        +context_relevance: float
        +faithfulness: float
    }

    class GoldenTestCase {
        +id: str
        +question: str
        +expected_contexts: list~str~
        +ground_truth: str
        +brain_id: str
        +metadata: dict
    }

    class GoldenDataset {
        +collection_name: str
        +test_cases: list~GoldenTestCase~
        +version: str
    }

    class EvaluationMetrics {
        +context_precision: float
        +context_recall: float
        +faithfulness: float
        +answer_relevancy: float
        +to_dict() dict
        +passes_thresholds(thresholds) tuple
    }

    class EvaluationResult {
        +collection_name: str
        +metrics: EvaluationMetrics
        +test_cases_evaluated: int
        +passed: bool
        +failures: list~str~
        +duration_seconds: float
        +error: str
    }

    class AggregatedResults {
        +collection_results: list~EvaluationResult~
        +total_test_cases: int
        +overall_passed: bool
        +collections_passed: int
        +collections_failed: int
        +to_dict() dict
    }

    class QdrantRAGEvaluator {
        -config: EvaluationConfig
        -client: QdrantClient
        -_embedding_cache: dict
        +evaluate_collection(name, dataset, brain_id) EvaluationResult
        -_retrieve_contexts(name, query, brain_id, top_k) list
        -_get_embedding(text) list~float~
        -_get_mock_embedding(text) list~float~
    }

    class CollectionEvaluator {
        -config: EvaluationConfig
        -evaluator: QdrantRAGEvaluator
        -datasets_dir: Path
        +evaluate_collection(name, brain_id, dataset) EvaluationResult
        +evaluate_all(names, brain_id) AggregatedResults
    }

    EvaluationConfig --> MetricThresholds
    GoldenDataset --> GoldenTestCase
    EvaluationResult --> EvaluationMetrics
    AggregatedResults --> EvaluationResult
    QdrantRAGEvaluator --> EvaluationConfig
    QdrantRAGEvaluator --> EvaluationResult
    CollectionEvaluator --> QdrantRAGEvaluator
    CollectionEvaluator --> AggregatedResults
```

---

## 5. Context Retrieval Detail

```mermaid
flowchart LR
    subgraph Input
        Q["Question<br/>'What are company size requirements?'"]
    end

    subgraph Embedding
        E["Voyage AI<br/>voyage-3.5-lite"]
        V["Vector<br/>[1024 dims]"]
    end

    subgraph QdrantQuery
        F["Filter<br/>brain_id='brain_iro_v1'"]
        QP["query_points()<br/>limit=5"]
    end

    subgraph Results
        SP["ScoredPoint[]"]
        PL["Payload<br/>text | content | rule_text"]
        CTX["Contexts<br/>list[str]"]
    end

    Q --> E
    E --> V
    V --> QP
    F --> QP
    QP --> SP
    SP --> PL
    PL --> CTX
```

---

## 6. Ragas Metrics Pipeline

```mermaid
flowchart TB
    subgraph InputDS["Ragas Dataset"]
        DS["Dataset<br/>questions + contexts + ground_truth + answers"]
    end

    subgraph LLMSetup["LLM Configuration"]
        OAI["OpenAI Client<br/>api_key"]
        LLM["llm_factory()<br/>gpt-4o-mini"]
        EMB["LangchainEmbeddingsWrapper<br/>text-embedding-3-small"]
    end

    subgraph Metrics["4 Ragas Metrics"]
        M1["ContextPrecision(llm)<br/>Are retrieved results relevant?"]
        M2["ContextRecall(llm)<br/>Are all relevant docs retrieved?"]
        M3["Faithfulness(llm)<br/>Is response faithful to context?"]
        M4["AnswerRelevancy(llm, emb)<br/>Is answer relevant to question?"]
    end

    subgraph Evaluation
        EVAL["ragas.evaluate()"]
    end

    subgraph Output
        RAW["Raw Results<br/>{metric: value | list | nan}"]
        SAFE["safe_float()<br/>Handle nan/list"]
        EM["EvaluationMetrics"]
    end

    OAI --> LLM
    OAI --> EMB
    LLM --> M1
    LLM --> M2
    LLM --> M3
    LLM --> M4
    EMB --> M4

    DS --> EVAL
    M1 --> EVAL
    M2 --> EVAL
    M3 --> EVAL
    M4 --> EVAL

    EVAL --> RAW
    RAW --> SAFE
    SAFE --> EM
```

---

## 7. Threshold Validation Flow

```mermaid
flowchart TD
    subgraph Config["Collection Thresholds"]
        T1["icp_rules<br/>precision: 0.85<br/>recall: 0.80<br/>relevance: 0.80<br/>faithfulness: 0.85"]
        T2["response_templates<br/>precision: 0.80<br/>recall: 0.75<br/>relevance: 0.85<br/>faithfulness: 0.85"]
        T3["objection_handlers<br/>precision: 0.80<br/>recall: 0.80<br/>relevance: 0.80<br/>faithfulness: 0.90"]
        T4["market_research<br/>precision: 0.75<br/>recall: 0.70<br/>relevance: 0.75<br/>faithfulness: 0.80"]
    end

    subgraph Validation["passes_thresholds()"]
        CMP1["precision >= threshold?"]
        CMP2["recall >= threshold?"]
        CMP3["relevancy >= threshold?"]
        CMP4["faithfulness >= threshold?"]
    end

    subgraph Result
        PASS["passed=True<br/>failures=[]"]
        FAIL["passed=False<br/>failures=['metric (0.72 < 0.80)']"]
    end

    T1 --> CMP1
    CMP1 -->|Yes| CMP2
    CMP1 -->|No| FAIL
    CMP2 -->|Yes| CMP3
    CMP2 -->|No| FAIL
    CMP3 -->|Yes| CMP4
    CMP3 -->|No| FAIL
    CMP4 -->|Yes| PASS
    CMP4 -->|No| FAIL
```

---

## 8. File Structure

```
mcp-servers/atlas_gtm_mcp/evaluation/
├── __init__.py
├── config.py                    # EvaluationConfig, MetricThresholds, COLLECTION_THRESHOLDS
├── cli.py                       # Entry point: main(), run_evaluation(), create_parser()
├── seed_test_data.py            # Seeds Qdrant with test data for CI
│
├── datasets/
│   ├── __init__.py
│   ├── loader.py                # GoldenTestCase, GoldenDataset, load_golden_dataset()
│   ├── icp_rules_golden.json    # Test cases for ICP rules
│   ├── response_templates_golden.json
│   ├── objection_handlers_golden.json
│   └── market_research_golden.json
│
├── evaluators/
│   ├── __init__.py
│   ├── qdrant_evaluator.py      # QdrantRAGEvaluator, EvaluationMetrics, EvaluationResult
│   └── collection_evaluator.py  # CollectionEvaluator, AggregatedResults
│
└── reporters/
    ├── __init__.py
    ├── json_reporter.py         # JSONReporter: save_report(), print_summary()
    └── langfuse_reporter.py     # LangfuseReporter: report_aggregated()
```

---

## 9. Key Code Paths

### CLI Entry → Evaluation
```
cli.py:main()
  ├─ create_parser() → argparse setup
  ├─ parse_args()
  └─ asyncio.run(run_evaluation(args))
        ├─ EvaluationConfig(qdrant_url, max_samples)
        └─ evaluate_collections(config, collections, brain_id)
              └─ CollectionEvaluator(config).evaluate_all()
```

### Per-Collection Evaluation
```
CollectionEvaluator.evaluate_all()
  └─ for collection in collections:
        evaluate_collection(name, brain_id)
          ├─ load_golden_dataset(path) → GoldenDataset
          └─ QdrantRAGEvaluator.evaluate_collection()
                ├─ for test_case in dataset:
                │     _retrieve_contexts()
                │       ├─ _get_embedding(question) → vector
                │       └─ client.query_points() → contexts
                ├─ Dataset.from_dict({questions, contexts, ground_truths, answers})
                ├─ ragas.evaluate(dataset, metrics)
                ├─ safe_float() extraction
                └─ passes_thresholds() → EvaluationResult
```

### Reporting
```
run_evaluation()
  ├─ JSONReporter.print_summary(results)
  ├─ JSONReporter.save_report(results) → JSON file
  └─ LangfuseReporter.report_aggregated(results) → Langfuse traces
```

---

## 10. Critical Implementation Details

### Brain-Scoped Queries (Multi-Tenant Isolation)
Every Qdrant query includes `brain_id` filter:
```python
# qdrant_evaluator.py:296-304
if brain_id:
    filter_conditions = Filter(
        must=[FieldCondition(
            key="brain_id",
            match=MatchValue(value=brain_id),
        )]
    )
```

### Mock Embeddings for CI
Deterministic 1024-dim vectors based on SHA256:
```python
# qdrant_evaluator.py:373-400
if os.getenv("CI") or os.getenv("USE_MOCK_EMBEDDINGS"):
    embedding = self._get_mock_embedding(text)  # SHA256-based
```

### Safe Float Extraction
Handles nan and list values from Ragas:
```python
# qdrant_evaluator.py:216-224
def safe_float(value, default=0.0):
    if isinstance(value, list):
        value = value[0] if value else default
    result = float(value)
    return default if math.isnan(result) else result
```

---

## Quick Reference

### CLI Usage

```bash
# Evaluate all collections
python -m atlas_gtm_mcp.evaluation.cli evaluate

# Evaluate specific collection
python -m atlas_gtm_mcp.evaluation.cli evaluate --collection icp_rules

# Evaluate with brain filter
python -m atlas_gtm_mcp.evaluation.cli evaluate --brain-id brain_iro_v1

# Save report and send to Langfuse
python -m atlas_gtm_mcp.evaluation.cli evaluate --output ./reports --langfuse

# Limit samples for quick testing
python -m atlas_gtm_mcp.evaluation.cli evaluate --max-samples 5

# List available datasets
python -m atlas_gtm_mcp.evaluation.cli list
```

### Seed Test Data for CI

```bash
# Set environment variable to use mock embeddings
export USE_MOCK_EMBEDDINGS=true

# Run seeding script
python -m atlas_gtm_mcp.evaluation.seed_test_data
```

---

## Summary

The RAG evaluation system follows a clean layered architecture:

1. **CLI Layer** - Parses args, creates config, invokes evaluation
2. **Orchestration Layer** - `CollectionEvaluator` manages batch evaluation
3. **Evaluation Layer** - `QdrantRAGEvaluator` queries Qdrant, runs Ragas metrics
4. **Data Layer** - Golden datasets (JSON) and Qdrant collections
5. **Reporting Layer** - JSON files and Langfuse integration

Key flows:
- Questions → Voyage AI embeddings → Qdrant vector search → Contexts
- Contexts + Ground Truth → Ragas metrics → Pass/Fail determination
- Results aggregated across collections → Reports generated
