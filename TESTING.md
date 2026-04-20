# ReportIQ Testing Guide

This guide covers how to start ReportIQ locally and how to test each major workflow in both connected mode and demo fallback mode.

## 1. Prerequisites

- Node.js 20+
- Python 3.11
- Docker Desktop or Docker Engine

Recommended local stack:

- Postgres from the repo `docker-compose.yml`
- `pgvector` enabled through the `pgvector/pgvector:pg16` image

Important:

- Connected mode requires Postgres with the `vector` extension available.
- A plain Homebrew `postgresql` install without `pgvector` is not enough for migrations in the current schema.

## 2. Environment Files

Backend:

```bash
cp backend/.env.example backend/.env
```

Frontend:

```bash
cp frontend/.env.example frontend/.env.local
```

Default values:

- Backend database URL: `postgresql+psycopg2://reportiq:reportiq@localhost:5432/reportiq`
- Frontend API base URL: `http://localhost:8000`
- Frontend demo mode default: `false`

Optional:

- Add `OPENAI_API_KEY` in `backend/.env` for real model calls.
- Leave it empty to exercise heuristic fallback behavior.

## 3. Start Local Infra

From the repo root:

```bash
docker compose up -d postgres
docker compose ps
```

Expected:

- Container `reportiq-postgres` is running
- Health status becomes healthy

Default local DB credentials:

- Database: `reportiq`
- User: `reportiq`
- Password: `reportiq`
- Port: `5432`

Quick DB check:

```bash
pg_isready -h localhost -p 5432
```

## 4. Install and Start the Backend

```bash
python3.11 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
alembic -c backend/alembic.ini upgrade head
python -m backend.scripts.seed_data
python -m backend.scripts.ingest_evidence
uvicorn backend.main:app --reload
```

Expected:

- Backend starts on `http://localhost:8000`
- No migration errors
- Seed command creates patient `id=1`
- Evidence ingestion reports ingested markdown documents

## 5. Start the Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Open:

- `http://localhost:3000`

Optional root shortcut after the initial frontend install:

```bash
npm run dev
```

## 6. Smoke Tests

### Backend health

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{"status":"ok","database":"ok","auth_enabled":false}
```

### Backend public config

```bash
curl http://localhost:8000/api/system/config
```

Expected:

- `auth_enabled`
- `demo_mode_enabled`
- `openai_chat_model`
- `openai_embedding_model`

### Patient list

```bash
curl http://localhost:8000/api/patient
```

Expected:

- HTTP 200
- At least one patient
- Seeded patient with `id=1`

## 7. Workflow Tests

### A. Patient Context

UI steps:

1. Open `http://localhost:3000/patient-profile`
2. Confirm the page loads seeded patient data
3. Confirm the selected patient defaults to the seeded patient when no manual choice has been made
4. Open `http://localhost:3000/timeline`
5. Confirm timeline entries are shown for the same patient

API checks:

```bash
curl http://localhost:8000/api/patient/1
curl http://localhost:8000/api/patient/1/timeline
```

Expected:

- Patient profile includes demographics, allergies, conditions, medications, alerts, tasks, and recent reports
- Timeline is sorted newest first

### B. Report Analyzer

UI steps:

1. Open `http://localhost:3000/report-analyzer`
2. Select a `.pdf`, `.txt`, `.md`, or `.docx` file
3. Confirm upload progress or loading state appears
4. Confirm the analysis result renders after upload
5. Navigate to Timeline and verify a new report-related event appears

API check:

```bash
curl -X POST http://localhost:8000/api/report/upload \
  -F "patient_id=1" \
  -F "file=@/absolute/path/to/sample-report.pdf"
```

Expected:

- HTTP 200
- Response includes:
  - `report_id`
  - `patient_id`
  - `classification`
  - `key_findings`
  - `summary`
  - `structured_data`
  - `timeline_event_id`
  - `filename`
  - `text_preview`

Negative tests:

- Upload a file larger than the configured max size and expect HTTP 400
- Upload an unsupported file type and expect HTTP 400

### C. Symptom Triage

UI steps:

1. Open `http://localhost:3000/symptom-triage`
2. Enter symptoms
3. Submit
4. Confirm loading, then result state
5. Confirm the result is linked to the selected patient when patient context is active
6. Open Timeline and verify a new triage event appears

API check:

```bash
curl -X POST http://localhost:8000/api/triage/analyze \
  -H "Content-Type: application/json" \
  -d '{"patient_id":1,"symptoms":"Shortness of breath with chest discomfort for two hours."}'
```

Expected:

- HTTP 200
- Response includes:
  - `session_id`
  - `risk_level`
  - `red_flags`
  - `recommended_action`
  - `summary`
  - `differential`
  - `timeline_event_id`

Negative tests:

- Submit empty `symptoms` and expect HTTP 400

### D. Timeline

UI steps:

1. Open `http://localhost:3000/timeline`
2. Confirm seeded events render first
3. Run one report analysis and one triage analysis
4. Refresh the page
5. Confirm both new events appear

Expected timeline schema per event:

- `event_type`
- `title`
- `summary`
- `timestamp`
- `patient_id`
- `metadata`

### E. Knowledge Center

Before testing, ensure ingestion ran:

```bash
source backend/.venv/bin/activate
python -m backend.scripts.ingest_evidence
```

If you are tuning around rate limits, you can slow ingestion down and reduce batch size:

```bash
python -m backend.scripts.ingest_evidence --batch-size 4 --throttle-seconds 0.5
```

Expected ingestion behavior:

- Retries embedding requests with exponential backoff
- Logs total chunks, successful embeddings, reused chunks, and failed embeddings
- Exits non-zero by default if any chunk still fails after retries
- Re-running fills missing or stale chunk embeddings without duplicating successful chunks

UI steps:

1. Open `http://localhost:3000/knowledge-center`
2. Search for a seeded topic such as `pulmonary nodule`, `chest pain`, or `clinical decision support`
3. Confirm ranked snippets render with citation metadata

API checks:

```bash
curl "http://localhost:8000/api/evidence/search?query=pulmonary%20nodule"
```

or

```bash
curl -X POST http://localhost:8000/api/evidence/search \
  -H "Content-Type: application/json" \
  -d '{"query":"chest pain escalation"}'
```

Expected:

- HTTP 200
- Response includes `query`, `sources`, and `mode`
- Each source includes:
  - `title`
  - `snippet` or snippet text
  - `source`
  - `url`
  - `section`
  - `page`
  - `score`

### F. Copilot

UI steps:

1. Open any page in the frontend
2. Click `Open Copilot` in the top navigation
3. Send a message
4. Confirm loading and assistant response states work
5. Send a follow-up message
6. Confirm the same conversation is reused in the session
7. If a patient is selected, confirm the chat behaves as patient-contextual

API check:

```bash
curl -X POST http://localhost:8000/api/copilot/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Summarize the current patient context and top risks.","context_patient_id":1}'
```

Expected:

- HTTP 200
- Response includes:
  - `conversation_id`
  - `patient_id`
  - `reply`
  - `message_id`
  - `citations`
  - `mode`

### G. Settings

UI steps:

1. Open `http://localhost:3000/settings`
2. Confirm the page shows the current API base URL
3. Confirm demo mode can be toggled
4. Confirm model names are visible as non-secret config only
5. Confirm EHR/FHIR items are marked `Coming soon`

Expected:

- No secret backend values are exposed
- Demo toggle changes frontend behavior without breaking routing

## 8. Demo Mode Tests

Enable demo mode in either of these ways:

- Set `NEXT_PUBLIC_DEMO_MODE=true` in `frontend/.env.local`
- Or use the Settings page toggle

Test:

1. Stop the backend
2. Reload the frontend
3. Open each page:
   - Dashboard
   - Report Analyzer
   - Symptom Triage
   - Patient Profile
   - Timeline
   - Knowledge Center
4. Confirm mock data and mock results still render

Expected:

- Frontend remains usable
- API failures degrade to demo behavior where implemented

## 9. Auth Tests

Local dev bypass:

- Leave Auth0 env vars empty
- Confirm backend routes remain accessible locally

Protected mode:

1. Set `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, and `AUTH0_ISSUER`
2. Restart backend
3. Retry protected routes without a bearer token

Expected:

- Requests to protected routes are rejected
- `/api/system/config` remains reachable

## 10. Current Known Local Blocker

Connected mode migrations require:

```sql
CREATE EXTENSION IF NOT EXISTS vector
```

If your local Postgres instance does not include `pgvector`, migration will fail before tables are created.

Typical error:

```text
could not open extension control file ".../extension/vector.control": No such file or directory
```

What to do:

- Use `docker compose up -d postgres` from this repo
- Or install a Postgres build that includes the `vector` extension

Without that extension:

- The backend server can still boot
- `/health` can still return `200`
- Real app routes such as `/api/patient` will fail because tables were never migrated

## 11. Troubleshooting

### `docker: command not found`

- Install Docker Desktop or Docker Engine

### `vector.control` missing

- You are not using a Postgres instance with `pgvector`
- Switch to the repo Docker setup

### `relation "patients" does not exist`

- Migrations did not run successfully
- Fix the database setup, then rerun:

```bash
alembic -c backend/alembic.ini upgrade head
python -m backend.scripts.seed_data
python -m backend.scripts.ingest_evidence
```

### Frontend shows demo data unexpectedly

- Check `NEXT_PUBLIC_DEMO_MODE`
- Check `NEXT_PUBLIC_API_BASE_URL`
- Check backend health at `http://localhost:8000/health`

### Backend starts but AI output looks generic

- `OPENAI_API_KEY` is likely unset
- The app is falling back to heuristic mode by design

## 12. Minimum Acceptance Checklist

- `docker compose up -d postgres` succeeds
- `alembic upgrade head` succeeds
- `seed_data` succeeds
- `ingest_evidence` succeeds
- `/health` returns 200
- `/api/patient` returns seeded data
- Report upload creates a persisted report and timeline event
- Triage creates a persisted session and timeline event
- Knowledge Center returns ingested evidence snippets
- Copilot stores and continues a conversation
- Settings shows live config and demo toggle behavior
- Demo mode still works when backend is unavailable
