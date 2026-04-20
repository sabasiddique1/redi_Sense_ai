# ReportIQ (Clin Assist)

ReportIQ is a local-first AI clinical copilot prototype with:

- `frontend/`: Next.js App Router clinician UI
- `backend/`: FastAPI API with SQLAlchemy, Alembic, Postgres, and pgvector-backed evidence search

The repo root now holds shared docs, Docker config, and lightweight workspace scripts only. Frontend source of truth lives entirely under `frontend/`.

The app now supports both:

- `Demo mode`: frontend falls back to curated mock data
- `Connected mode`: frontend talks to the FastAPI backend, persists data in Postgres, and uses real API routes

## What Works

### Connected mode
- Report upload and analysis with persistence and timeline event creation
- Symptom triage with persistence and timeline event creation
- Patient selection with backend-backed patient profile and timeline
- Knowledge Center search over a local ingested evidence dataset
- Copilot drawer with DB-backed conversations/messages and optional patient context
- Settings page showing live non-secret backend config

### Demo fallback
- All major frontend workflows still render usable mock results if the backend is unavailable
- Demo/connected mode can be toggled from Settings

## Prerequisites

- Node.js 20+
- Python 3.11
- Docker Desktop or Docker Engine

## Local Infrastructure

The repo includes a root [`docker-compose.yml`](/Users/saba/Desktop/Projects/clin_assist/docker-compose.yml) that starts Postgres with pgvector enabled.

Default local database credentials:

- Database: `reportiq`
- User: `reportiq`
- Password: `reportiq`
- Port: `5432`
- Default URL: `postgresql+psycopg2://reportiq:reportiq@localhost:5432/reportiq`

Start Postgres:

```bash
docker compose up -d postgres
docker compose ps
```

The init script at [`docker/postgres/init/01-enable-vector.sql`](/Users/saba/Desktop/Projects/clin_assist/docker/postgres/init/01-enable-vector.sql) enables the `vector` extension automatically.

## Environment Setup

Backend example env: [`backend/.env.example`](/Users/saba/Desktop/Projects/clin_assist/backend/.env.example)

Frontend example env: [`frontend/.env.example`](/Users/saba/Desktop/Projects/clin_assist/frontend/.env.example)

### Backend envs

- `OPENAI_API_KEY`
- `OPENAI_CHAT_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- `POSTGRES_URL`
- `AUTH0_DOMAIN` optional
- `AUTH0_AUDIENCE` optional
- `AUTH0_ISSUER` optional

If `OPENAI_API_KEY` is omitted, the backend still works using conservative heuristic fallbacks for report analysis, triage, copilot, and embeddings.

### Frontend envs

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_DEMO_MODE` optional

## Backend Setup

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
cd ..
```

Run migrations:

```bash
source backend/.venv/bin/activate
alembic -c backend/alembic.ini upgrade head
```

Seed local data:

```bash
source backend/.venv/bin/activate
python -m backend.scripts.seed_data
```

Ingest the bundled evidence dataset:

```bash
source backend/.venv/bin/activate
python -m backend.scripts.ingest_evidence
```

Useful ingestion flags:

```bash
python -m backend.scripts.ingest_evidence --batch-size 4 --throttle-seconds 0.5
python -m backend.scripts.ingest_evidence --allow-heuristic-fallback
python -m backend.scripts.ingest_evidence --allow-partial-success
```

By default the ingestion command retries embedding requests with exponential backoff and exits non-zero if any chunk still fails after retries.

Start the backend:

```bash
source backend/.venv/bin/activate
uvicorn backend.main:app --reload
```

Health check:

```bash
curl http://localhost:8000/health
```

## Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional root shortcuts:

```bash
npm run dev
npm run lint
npm run test
npm run typecheck
```

## Recommended First-Time Flow

1. `docker compose up -d postgres`
2. Install backend dependencies with Python 3.11
3. `alembic -c backend/alembic.ini upgrade head`
4. `python -m backend.scripts.seed_data`
5. `python -m backend.scripts.ingest_evidence`
6. Start `uvicorn backend.main:app --reload`
7. Start `npm run dev` in `frontend/` or from the repo root

## Database and Migrations

Alembic is configured under [`backend/alembic`](/Users/saba/Desktop/Projects/clin_assist/backend/alembic) with the initial schema revision at [`backend/alembic/versions/20260318_0001_initial.py`](/Users/saba/Desktop/Projects/clin_assist/backend/alembic/versions/20260318_0001_initial.py).

Primary tables:

- `patients`
- `reports`
- `triage_sessions`
- `timeline_events`
- `copilot_conversations`
- `copilot_messages`
- `evidence_documents`
- `evidence_chunks`

## Seed Data

The seed command creates or updates:

- Patient `id=1`
- Sample reports
- A sample triage session
- Timeline events

The seed script is idempotent and lives at [`backend/scripts/seed_data.py`](/Users/saba/Desktop/Projects/clin_assist/backend/scripts/seed_data.py).

## Evidence Search

Evidence ingestion reads markdown/text files from [`backend/sample_data/evidence`](/Users/saba/Desktop/Projects/clin_assist/backend/sample_data/evidence) and stores chunk embeddings in Postgres using pgvector.

Search API:

- `GET /api/evidence/search?query=...`
- `POST /api/evidence/search`

## API Routes

- `GET /health`
- `GET /api/system/config`
- `GET /api/patient`
- `GET /api/patient/{patient_id}`
- `GET /api/patient/{patient_id}/timeline`
- `POST /api/report/analyze`
- `POST /api/report/upload`
- `POST /api/triage/analyze`
- `GET /api/evidence/search`
- `POST /api/evidence/search`
- `POST /api/copilot/chat`

## Auth0 and Local Dev

- If Auth0 env vars are not set, backend auth stays in dev-bypass mode so local development is not blocked.
- If `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, and `AUTH0_ISSUER` are provided, the backend verifies bearer tokens using Auth0 JWKS.
- Most product routes are mounted behind this optional auth dependency.

## Safety and Logging

- Backend logging includes request IDs and avoids logging raw report text or sensitive payload bodies.
- API responses include clinical decision-support disclaimers.
- Copilot, report analysis, and triage are assistive workflows only and must be clinically verified before use.

## Notes

- Report upload currently supports `PDF`, `TXT`, `MD`, and `DOCX`.
- The included evidence dataset is a small local curated sample for development.
- Settings intentionally surface only non-secret runtime metadata; secret keys remain backend-only.
