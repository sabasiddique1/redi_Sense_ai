# ReportIQ Frontend (Next.js)

This folder contains the **ReportIQ** web UI built with **Next.js App Router** + **Tailwind CSS**.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

From the repo root, `npm run dev`, `npm run lint`, `npm run test`, and `npm run typecheck` proxy into this frontend workspace.

## Configuration

- **Backend API base URL**: set `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:8000`).

Example:

```bash
export NEXT_PUBLIC_API_BASE_URL="http://localhost:8000"
```

## How the UI behaves without the backend

Most screens attempt to call the backend, but **fall back to built-in mock data** if the API is unavailable.
That means you can demo the UI without running Postgres/OpenAI.

## Pages

- `/` — Dashboard (risk snapshot + queue + alerts)
- `/report-analyzer` — Report analysis (calls `POST /api/report/analyze`)
- `/symptom-triage` — Symptom triage (calls `POST /api/triage/analyze`)
- `/knowledge-center` — Evidence search (calls `GET /api/evidence/search`)
- `/patient-profile` — Patient overview (currently mock-only)
- `/timeline` — Patient timeline (calls `GET /api/patient/1/timeline`)
- `/settings` — Integrations/settings placeholders
