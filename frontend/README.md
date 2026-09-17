# RediSense Frontend (Next.js)

This folder contains the **RediSense** web UI built with **Next.js App Router** + **Tailwind CSS**.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

From the repo root, `npm run dev`, `npm run lint`, `npm run test`, and `npm run typecheck` proxy into this frontend workspace.

## Configuration

Copy `.env.example` to `.env.local`. Variables read by the app:

- `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`)
- `NEXT_PUBLIC_DEMO_MODE` (default `false`)
- `NEXT_PUBLIC_EVIDENCE_SEARCH_TIMEOUT_MS` (default `15000`)

## Demo vs connected mode

Demo mode is explicit: enable it with `NEXT_PUBLIC_DEMO_MODE=true` or the Settings toggle, and every page renders curated mock data without calling the backend. In connected mode a failing API call shows an error; it does not silently fall back to mock data (see `tests/api-client.test.ts`).

## Pages

- `/` — Dashboard (calls `GET /api/dashboard/summary`)
- `/report-analyzer` — Report upload and analysis (calls `POST /api/report/upload`)
- `/symptom-triage` — Symptom triage (calls `POST /api/triage/analyze`)
- `/patient-profile` — Patient overview (calls `GET /api/patient/{id}`)
- `/timeline` — Patient timeline (calls `GET /api/patient/{id}/timeline`)
- `/knowledge-center` — Evidence search (calls `GET /api/evidence/search`)
- `/settings` — Live backend config and the demo/connected toggle

The Copilot drawer is global (`POST /api/copilot/chat`, `GET /api/copilot/conversations`).
