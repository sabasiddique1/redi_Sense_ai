# RediSense

RediSense is a local-first AI clinical copilot for clinicians. It analyses uploaded medical reports, triages symptoms against rule-based red flags, keeps a per-patient timeline, and answers questions with citations drawn from a locally ingested evidence corpus. Every AI output is decision *support*: the backend grounds model output in retrieved evidence, refuses to invent citations, and falls back to conservative heuristics when no model key is configured.

> **Disclaimer.** RediSense is a prototype for research and demonstration. It is not a medical device and must not be used for diagnosis or treatment decisions without independent clinical verification.

## Screenshots

_Placeholders, drop PNGs into `docs/screenshots/` with these names._

| Dashboard | Report Analyzer | Symptom Triage |
|---|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Report Analyzer](docs/screenshots/report-analyzer.png) | ![Symptom Triage](docs/screenshots/symptom-triage.png) |

| Knowledge Center | Timeline | Copilot drawer |
|---|---|---|
| ![Knowledge Center](docs/screenshots/knowledge-center.png) | ![Timeline](docs/screenshots/timeline.png) | ![Copilot](docs/screenshots/copilot.png) |

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    FE["Next.js 16 App Router<br/>frontend/"]
  end
  subgraph API["FastAPI  backend/"]
    R["api/*_routes.py"]
    AG["agents/<br/>report · triage · copilot · evidence"]
    SV["services/<br/>openai · vector · triage · timeline · storage"]
    R --> AG --> SV
  end
  PG[("Postgres 16<br/>+ pgvector")]
  OAI["OpenAI<br/>chat + embeddings<br/>(optional)"]

  FE -- "JSON / multipart<br/>lib/api.ts" --> R
  SV -- "SQLAlchemy / Alembic" --> PG
  SV -. "heuristic fallback<br/>when no API key" .-> OAI
```

- **Frontend** ([`frontend/`](frontend/)): Next.js 16 App Router, React 19, Tailwind v4. One feature module per page under [`frontend/features/`](frontend/features/), a typed API client in [`frontend/lib/api.ts`](frontend/lib/api.ts), and global app state (demo toggle, selected patient, public config) in [`AppStateProvider.tsx`](frontend/components/providers/AppStateProvider.tsx).
- **Backend** ([`backend/`](backend/)): FastAPI, SQLAlchemy 2, Alembic, Pydantic v2. Routes delegate to agents, agents orchestrate services, services own persistence and model calls.
- **Data**: Postgres with the `vector` extension. Evidence markdown is chunked, embedded, and stored in `evidence_chunks`; retrieval is hybrid (SQL full-text + pgvector cosine) with a heuristic rerank.

## Features

| Area | Connected mode | Demo mode |
|---|---|---|
| Dashboard | Aggregate metrics, queue, risk distribution from the database | Curated mock snapshot |
| Report Analyzer | Upload PDF/TXT/MD/DOCX, extraction-grounded analysis, persisted report + timeline event | Mock analysis on submit |
| Symptom Triage | Rule-based red flags merged with model output, persisted session + timeline event | Mock triage result |
| Patient Profile | Seeded patient demographics, meds, allergies, alerts, recent reports | Mock profile |
| Timeline | Newest-first events per patient | Mock events |
| Knowledge Center | Hybrid retrieval over the local evidence index with trace metadata | Mock sources |
| Copilot drawer | Retrieval-grounded chat with validated citations, DB-backed conversations | Mock replies |
| Settings | Live non-secret backend config, demo/connected toggle | Same |

Demo mode is explicit. In connected mode a failing API call surfaces an error; it never silently swaps in mock data. Toggle it from Settings or with `NEXT_PUBLIC_DEMO_MODE=true`.

## Quickstart

Prerequisites: Node.js 20+, Python 3.11, Docker.

```bash
# 1. Database (Postgres 16 + pgvector)
docker compose up -d postgres

# 2. Backend
python3.11 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env          # add OPENAI_API_KEY for real model calls
alembic -c backend/alembic.ini upgrade head
python -m backend.scripts.seed_data           # idempotent; creates patient id=1
python -m backend.scripts.ingest_evidence     # embeds backend/sample_data/evidence
uvicorn backend.main:app --reload             # http://localhost:8000

# 3. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local
npm run dev                                   # http://localhost:3000
```

Root shortcuts proxy into `frontend/`: `npm run dev|build|lint|test|typecheck`.

If you previously ran this repo under its old name, the Postgres volume still holds the `reportiq` role and database. Either keep the old `POSTGRES_URL` or reset with `docker compose down -v` before starting.

Useful ingestion flags:

```bash
python -m backend.scripts.ingest_evidence --batch-size 4 --throttle-seconds 0.5
python -m backend.scripts.ingest_evidence --allow-heuristic-fallback
python -m backend.scripts.ingest_evidence --allow-partial-success
```

## Environment

Backend, from [`backend/.env.example`](backend/.env.example):

| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | empty | Enables real chat/embedding calls; empty means heuristic fallback everywhere |
| `OPENAI_CHAT_MODEL` | `gpt-4o-mini` | Chat model for report, triage, copilot |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | 1536-dim embeddings for evidence chunks |
| `EMBEDDING_BATCH_SIZE` / `EMBEDDING_MAX_RETRIES` / `EMBEDDING_*_BACKOFF_SECONDS` / `EMBEDDING_THROTTLE_SECONDS` | `8` / `5` / `1.0`–`20.0` / `0.25` | Ingestion rate limiting |
| `EVIDENCE_SEARCH_TIMEOUT_SECONDS` | `8.0` | Server-side budget for one evidence search |
| `EVIDENCE_QUERY_EMBEDDING_MAX_RETRIES` | `1` | Retries for the query embedding call |
| `EVIDENCE_DB_STATEMENT_TIMEOUT_MS` | `1500` | Postgres statement timeout for retrieval |
| `EVIDENCE_VECTOR_CANDIDATE_LIMIT` | `8` | Vector candidates before rerank |
| `POSTGRES_URL` | `postgresql+psycopg2://redisense:redisense@localhost:5432/redisense` | SQLAlchemy URL |
| `AUTH0_DOMAIN` / `AUTH0_AUDIENCE` / `AUTH0_ISSUER` | empty | When all three are set, bearer tokens are verified via Auth0 JWKS; otherwise dev bypass |
| `ALLOWED_ORIGINS` | `["http://localhost:3000","http://127.0.0.1:3000"]` | CORS |
| `DEMO_MODE_ENABLED` | `true` | Surfaced via `/api/system/config` |
| `MAX_UPLOAD_SIZE_MB` | `10` | Report upload limit |

Frontend, from [`frontend/.env.example`](frontend/.env.example):

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Backend origin |
| `NEXT_PUBLIC_DEMO_MODE` | `false` | Initial demo/connected mode; the Settings toggle overrides it |
| `NEXT_PUBLIC_EVIDENCE_SEARCH_TIMEOUT_MS` | `15000` | Client timeout for Knowledge Center search |

## API routes

All `/api/*` routes except `/api/system/config` sit behind the optional Auth0 dependency.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness plus a `SELECT 1` against Postgres |
| GET | `/api/system/config` | Non-secret runtime config for the Settings page |
| GET | `/api/dashboard/summary` | Aggregate metrics, report queue, risk distribution, alerts, recent activity |
| GET | `/api/patient` | Patient list |
| GET | `/api/patient/{id}` | Patient profile with recent reports |
| GET | `/api/patient/{id}/timeline` | Timeline events, newest first |
| POST | `/api/report/analyze` | Analyse raw report text |
| POST | `/api/report/upload` | Multipart upload (PDF/TXT/MD/DOCX), extract, analyse, persist |
| POST | `/api/triage/analyze` | Symptom triage; persists a session and a timeline event |
| GET, POST | `/api/evidence/search` | Hybrid evidence retrieval with trace |
| POST | `/api/copilot/chat` | Retrieval-grounded chat with validated citations |
| GET | `/api/copilot/conversations` | Recent conversations, optionally filtered by patient |
| GET | `/api/copilot/conversations/{id}` | One conversation with messages |

Interactive docs are served by FastAPI at `http://localhost:8000/docs`.

## Testing

```bash
# Frontend: TypeScript, ESLint, node:test unit tests
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run test

# Backend: pytest, runs entirely on an in-memory fake session (no Postgres needed)
python -m pytest backend/tests -q
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the same commands plus `next build` on every push and pull request. Manual end-to-end steps for both modes are in [`TESTING.md`](TESTING.md); a seeded validation pack is in [`test-assets/`](test-assets/).

## RAG design

Full write-up: [`RAG_IMPROVEMENTS_REPORT.md`](RAG_IMPROVEMENTS_REPORT.md).

- **Chunking** is section-aware and paragraph-aware with approximate token budgets and overlap, configurable in [`backend/config.py`](backend/config.py).
- **Retrieval** is hybrid. SQL full-text search over a denormalised `search_text` column runs first, then pgvector cosine search on the query embedding; candidates are merged and heuristically reranked. An IVFFlat index and a GIN index are added by [`20260406_0002_rag_retrieval_indexes.py`](backend/alembic/versions/20260406_0002_rag_retrieval_indexes.py).
- **Grounded citations.** The copilot assigns prompt-local ids (`E1`, `E2`, ...) to retrieved chunks and asks the model for `citation_ids` only. The server maps those ids back to real chunks; unsupported ids trigger a conservative fallback instead of an ungrounded answer. Each response carries a `rag_trace` and an `insufficient_evidence` flag.
- **Evaluation scaffold.** [`backend/evals/rag_benchmark.json`](backend/evals/rag_benchmark.json) and [`backend/scripts/evaluate_rag.py`](backend/scripts/evaluate_rag.py) provide a lightweight retrieval recall check.
- **Known limits.** Knowledge Center is retrieval-only (no answer generation), the reranker is heuristic, and metadata filters exist internally but are not exposed in the API.

## Database

Alembic migrations live in [`backend/alembic/versions/`](backend/alembic/versions/). Tables: `patients`, `reports`, `triage_sessions`, `timeline_events`, `copilot_conversations`, `copilot_messages`, `evidence_documents`, `evidence_chunks`. The `vector` extension is enabled by [`docker/postgres/init/01-enable-vector.sql`](docker/postgres/init/01-enable-vector.sql); a Postgres without pgvector will fail at migration time.

## Safety and logging

- Request logging carries request ids and never writes raw report text or payload bodies.
- API responses include clinical decision-support disclaimers.
- Report analysis is extraction-grounded; triage keeps rule-based urgency even when a model tries to downgrade it.
- Settings surfaces only non-secret runtime metadata.

## License

[MIT](LICENSE)
