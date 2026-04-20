# RAG Improvements Report

## Summary of the original problems

The codebase already had a retrieval subsystem, but it was not operating as a full retrieval-augmented generation stack:

- Knowledge Center performed retrieval only and returned sources without answer generation.
- Copilot chat used patient/chart context, but it did not retrieve evidence or ground answers in retrieved chunks.
- Copilot citations were not derived from retrieved evidence.
- Evidence chunking used fixed character windows.
- Lexical retrieval loaded all chunks into Python and ranked them in-process.
- No ANN vector index was present for pgvector embeddings.
- Retrieval trace data was not preserved in a structured way for debugging or evaluation.

## Files modified

- `backend/config.py`
  - Added configurable chunking and retrieval settings:
    - `evidence_chunk_size_tokens`
    - `evidence_chunk_overlap_tokens`
    - `evidence_lexical_candidate_limit`
    - `evidence_copilot_top_k`
    - `evidence_keyword_filter_limit`
    - `evidence_enable_heuristic_rerank`

- `backend/db/models.py`
  - Added `EvidenceChunk.search_text` to denormalize title/section/content for indexed lexical retrieval.

- `backend/db/schemas.py`
  - Extended copilot citation schema with grounded metadata:
    - `citation_id`
    - `chunk_id`
    - `snippet`
    - `score`
  - Added `CopilotRagTrace` and related trace models.
  - Added `insufficient_evidence` and `rag_trace` to `CopilotChatResponse`.
  - Added optional `trace` to `EvidenceSearchResult`.

- `backend/services/vector_service.py
  - Replaced fixed character chunking with section-aware, paragraph-aware, approximate token-based chunking.
  - Added denormalized `search_text` support for lexical retrieval.
  - Added indexed SQL full-text lexical retrieval with Python fallback.
  - Added retrieval filters scaffold (`sources`, `document_ids`, `section_query`).
  - Added heuristic reranking stage scaffold.
  - Added optional chunk-level retrieval by disabling document dedupe.
  - Added trace generation to retrieval results.

- `backend/services/openai_service.py`
  - Switched copilot LLM output from free-form citations to validated `citation_ids`.
  - Added grounded copilot prompt usage through a prompt helper module.
  - Preserved strict structured JSON validation for copilot outputs.

- `backend/services/rag_prompts.py`
  - New prompt helper module for grounded copilot prompting.
  - Added `COPILOT_RAG_PROMPT_VERSION`.
  - Added prompt evidence formatting utilities.

- `backend/agents/copilot_agent.py`
  - Integrated retrieval into copilot flow.
  - Retrieves evidence chunks before calling the LLM.
  - Passes retrieved chunks into grounded copilot prompts.
  - Maps model `citation_ids` back to known retrieved chunks only.
  - Rejects unsupported citation ids by falling back to grounded heuristic behavior.
  - Stores `rag_trace` and `insufficient_evidence` in assistant message metadata and API responses.

- `backend/agents/evidence_agent.py`
  - Threads retrieval `trace` through evidence search responses.

- `backend/alembic/versions/20260406_0002_rag_retrieval_indexes.py`
  - New migration adding:
    - `evidence_chunks.search_text`
    - GIN full-text index on `search_text`
    - IVFFlat pgvector index on `embedding`

- `backend/evals/rag_benchmark.json`
  - Added a lightweight benchmark dataset for retrieval evaluation.

- `backend/scripts/evaluate_rag.py`
  - Added a lightweight retrieval benchmark runner.

- `frontend/lib/contracts.ts`
  - Added TS fields for:
    - grounded copilot citation metadata
    - `insufficient_evidence`
    - `rag_trace`
    - evidence `trace`

- `frontend/components/copilot/CopilotDrawer.tsx`
  - Displays citation snippets when available.

- `frontend/features/knowledge-center/view-model.ts`
  - Removed the misleading `usedInAnswer` behavior from Knowledge Center cards.

- `frontend/features/knowledge-center/KnowledgeCenterPage.tsx`
  - Updated subtitle text to match actual behavior.

- `backend/tests/test_copilot_agent.py`
  - Added coverage for grounded citations and retrieval-backed copilot behavior.

- `backend/tests/test_vector_service.py`
  - Added chunking coverage for the new section-aware token-aware chunker.

## New files added

- `backend/services/rag_prompts.py`
- `backend/alembic/versions/20260406_0002_rag_retrieval_indexes.py`
- `backend/evals/rag_benchmark.json`
- `backend/scripts/evaluate_rag.py`
- `RAG_IMPROVEMENTS_REPORT.md`

## What changed in each major area and why

### 1. Copilot is now a real retrieval-to-generation flow

Before:
- Copilot used only patient/chart context.
- It did not retrieve evidence.
- Citations were not tied to retrieved sources.

Now:
- `CopilotAgent.chat()` retrieves evidence chunks from `VectorService.search(..., dedupe_by_document=False)`.
- Retrieved chunks are converted into prompt evidence items with stable evidence ids (`E1`, `E2`, ...).
- The LLM receives:
  - the user question
  - patient context
  - retrieved evidence snippets
- The model must return:
  - `reply`
  - `citation_ids`
  - `insufficient_evidence`
- Server-side code maps `citation_ids` back to the retrieved chunks.
- If the model returns unsupported citation ids, the agent falls back to a grounded heuristic reply rather than passing ungrounded output through.

Why:
- This creates a real retrieval-augmented generation path.
- It prevents invented sources.
- It keeps citations trustworthy because the server owns the citation mapping.

### 2. Chunking is now section-aware and token-aware

Before:
- Evidence was chunked by raw character windows with overlap.

Now:
- `_chunk_text()` uses:
  - markdown section headings when present
  - paragraph boundaries
  - approximate token budgets
  - overlapping paragraph windows
- Chunk sizes are now configurable via backend settings.

Why:
- This produces cleaner chunks.
- It reduces semantic fragmentation compared with raw character slicing.

### 3. Lexical retrieval is no longer Python full-scan first

Before:
- Retrieval loaded every chunk into Python via `_load_search_rows()`.
- Lexical ranking happened in Python over the full corpus.

Now:
- `_build_lexical_candidates()` first uses PostgreSQL full-text search on `search_text`.
- Python ranking remains as a fallback path when SQL lexical search is unavailable.

Why:
- This is materially more production-oriented.
- It lowers the cost of lexical retrieval as the corpus grows.

### 4. Hybrid retrieval is more structured

Before:
- The system blended lexical and vector retrieval but exposed little trace data.

Now:
- Search returns a trace containing:
  - normalized query
  - lexical strategy used
  - retrieval mode
  - fallback reason
  - filters
  - selected chunks

Why:
- This improves debuggability and later evaluation work.

### 5. Vector storage now has migration support for ANN indexing

Before:
- pgvector existed but no ANN index was found.

Now:
- Added IVFFlat index migration for `evidence_chunks.embedding`.

Why:
- This is required to move toward scalable vector retrieval.

## Migrations required

Yes.

Run:

```bash
cd /Users/saba/Desktop/Projects/clin_assist/backend
source .venv/bin/activate
PYTHONPATH=.. .venv/bin/alembic -c alembic.ini upgrade head
```

## Re-ingestion / re-indexing required

Yes.

Reason:
- Chunking changed.
- `search_text` was added.
- Existing chunk boundaries and search metadata should be rebuilt.

Run:

```bash
cd /Users/saba/Desktop/Projects/clin_assist/backend
source .venv/bin/activate
PYTHONPATH=.. .venv/bin/python -m backend.scripts.ingest_evidence --allow-heuristic-fallback
```

If you want a clean rebuild, clear existing evidence rows first in a controlled migration/DB maintenance step before re-ingesting.

## How grounded citations now work

1. Retrieval returns actual evidence chunks.
2. Copilot assigns prompt-local ids like `E1`, `E2`, `E3`.
3. The prompt explicitly tells the model to cite only those ids.
4. The model returns `citation_ids`.
5. The backend validates those ids against the retrieved evidence map.
6. Only validated ids are converted into user-visible citations.
7. If the model does not cite retrieved evidence correctly, the system falls back instead of showing unsupported citations.

This means citations are now derived from known retrieved chunks, not from model-generated source text.

## How the new RAG flow works end-to-end

### Copilot flow

1. User sends message to `/api/copilot/chat`
2. `CopilotAgent` gathers patient context
3. `CopilotAgent` builds a retrieval query
4. `VectorService.search()` retrieves chunk-level evidence
5. `CopilotAgent` converts retrieved chunks into prompt evidence items
6. `openai_service.chat_with_copilot()` sends a grounded prompt to OpenAI
7. OpenAI returns `reply`, `citation_ids`, `insufficient_evidence`
8. `CopilotAgent` validates the citation ids
9. Validated citations are attached to the response
10. `rag_trace` is stored in message metadata and returned in the API payload

### Knowledge Center flow

Knowledge Center remains retrieval-only, but retrieval itself is now improved:

1. User query hits `/api/evidence/search`
2. SQL full-text lexical retrieval is attempted first
3. Query embedding is generated
4. pgvector search is run
5. Candidates are merged and reranked heuristically
6. Results are returned with trace metadata

## Lightweight evaluation scaffold

Added:
- `backend/evals/rag_benchmark.json`
- `backend/scripts/evaluate_rag.py`

Run:

```bash
cd /Users/saba/Desktop/Projects/clin_assist/backend
source .venv/bin/activate
PYTHONPATH=.. .venv/bin/python -m backend.scripts.evaluate_rag
```

This is not a full production eval framework yet. It is a benchmark-ready scaffold for retrieval recall checks.

## Limitations / follow-up recommendations

These improvements are real, but not everything is complete:

- Knowledge Center still does not generate final answers from retrieved evidence.
- The reranker is heuristic only, not model-based.
- Metadata filters are implemented as internal hooks, not yet exposed in the public API/UI.
- The evaluation scaffold is retrieval-focused and lightweight, not a full faithfulness/grounding eval suite.
- Copilot still relies on OpenAI for generation and does not use conversation history for retrieval.
- The IVFFlat index is a meaningful step forward, but may need tuning (`lists`) based on production corpus size.
- Full-text retrieval now depends on `search_text`; re-ingestion is important to get clean results.

## What still remains unimplemented

- true citation-aware answer generation for Knowledge Center
- full offline RAG eval framework with golden answers and grounding metrics
- model-based reranking
- metadata filtering in the public evidence API
- caching for query embeddings and retrieval results
- conversation-history-aware retrieval
- automated stale document deletion across full corpus sync

## Verification completed

The following checks were run successfully after the changes:

```bash
backend/.venv/bin/python -m unittest backend.tests.test_copilot_agent backend.tests.test_vector_service backend.tests.test_evidence_agent backend.tests.test_report_analysis_service backend.tests.test_timeline_persistence backend.tests.test_triage_agent backend.tests.test_triage_service
npm --prefix frontend run typecheck
npm --prefix frontend run lint
```
