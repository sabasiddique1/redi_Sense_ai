# Changelog: September 2026 redesign

Scope: every change between `938b041` ("Clean repo: removed large frontend.zip", the squashed
baseline) and `9d7e61e`, the head of `feat/ui-redesign` ([PR #1](https://github.com/sabasiddique1/redi_Sense_ai/pull/1)).
Fifteen commits, 162 files, +10,437 / −2,786 lines (`git diff --shortstat 938b041..9d7e61e`).
Sources for every figure below: the commit messages, the PR #1 body, the Phase 1 inspection
canvas (four artboards: token sheet review, chart inventory, shared components, task list), and
the diffs themselves.

| Commit | Date | Subject |
|---|---|---|
| `d1f55c5` | 2026-09-16 | chore(repo): rebrand to RediSense, rewrite README, add CI, LICENSE, env example |
| `3f50443` | 2026-09-16 | feat(dashboard): wire Dashboard to a backend aggregate endpoint |
| `fd691c8` | 2026-09-17 | feat(ui): tokenise colours, RediSense identity layer, page states, verdict blocks, user context |
| `5e600ab` | 2026-09-17 | fix(backend): resolve alembic script_location relative to alembic.ini |
| `b086adb` | 2026-09-17 | fix(copilot): do not treat a null active conversation as loading |
| `4e99f41` | 2026-09-17 | chore: ignore .claude, hydration-safe app state, record-count insight label, drop dead API exports |
| `5d82d18` | 2026-09-17 | feat(theme): RediSense design tokens, dark theme, theme provider, fonts (G1) |
| `fb24c12` | 2026-09-17 | feat(ui): pure-SVG chart kit and shared design primitives (G2) |
| `69056fa` | 2026-09-17 | feat(dashboard): rebuild Dashboard on the design (G3) |
| `fd12543` | 2026-09-17 | feat(triage-analyzer): design layouts for Symptom Triage and Report Analyzer (G4) |
| `d43a166` | 2026-09-17 | feat(evidence-copilot): Knowledge Center and Copilot drawer on the design (G5) |
| `770a975` | 2026-09-17 | feat(pages): Patient Profile, Timeline and Settings on the design (G6) |
| `d706c1d` | 2026-09-17 | feat(shell): sidebar, top bar and 1024px collapse on the design (G7) |
| `384b320` | 2026-09-17 | fix(a11y): inert closed drawer, keyboard-reachable main, accessible names; verification scripts |
| `9d7e61e` | 2026-09-17 | docs(screenshots): production screenshots for README, before/after matrix; unescape demo copy |

## 1. Summary

At `938b041` the app was "ReportIQ / Clin Assist": a Next.js front end with 343 inline hex colour
utilities, a mock-only Dashboard, a light theme only, no README beyond the Next.js default, no CI,
no licence, and 5 frontend tests of which 1 failed.
At `9d7e61e` it is RediSense: every colour comes from 68 `--rs-*` tokens per theme in
[frontend/app/globals.css](../frontend/app/globals.css), light and dark, with a no-flash theme provider.
The Dashboard reads a real `GET /api/dashboard/summary` aggregate; all seven pages, the shell and the
Copilot drawer are rebuilt on the approved Claude Design export in `design/`.
Charts are a hand-written SVG kit (11 components, no library); 14 shared primitives replace the
page-local cards. Lighthouse on the production build is 98–100 / 100 / 100 on Dashboard, Triage and
Analyzer, axe-core reports 0 serious or critical issues across 56 renders, and the largest route grew
10.5 KB gzipped.
Tests went from 5 → 34 frontend and 19 → 22 backend; CI runs both on every push and pull request.

## 2. Repo and docs hygiene

- **Rebrand to RediSense** (`d1f55c5`). ReportIQ / Clin Assist renamed across README, metadata,
  sidebar, Copilot heading, package names, [docker-compose.yml](../docker-compose.yml),
  [backend/config.py](../backend/config.py), [backend/alembic.ini](../backend/alembic.ini) and the two
  user-visible LLM strings in [backend/services/openai_service.py](../backend/services/openai_service.py)
  and [backend/services/rag_prompts.py](../backend/services/rag_prompts.py). The evidence source label
  "ReportIQ curated local dataset" and its test fixtures were kept on purpose.
- **README rewrite** (`d1f55c5`): architecture diagram, features by mode, quickstart, environment
  tables, API routes, testing, RAG summary, safety, licence, screenshot placeholders; absolute
  `/Users` paths replaced with relative links. [frontend/README.md](../frontend/README.md),
  [RAG_IMPROVEMENTS_REPORT.md](../RAG_IMPROVEMENTS_REPORT.md) and [TESTING.md](../TESTING.md) had stale
  claims and paths fixed. `384b320` added the token-system and screenshot notes; `9d7e61e` replaced
  the placeholders with production screenshots.
- **Environment examples** (`d1f55c5`): [frontend/.env.example](../frontend/.env.example) with the three
  `NEXT_PUBLIC_*` variables that [frontend/lib/api.ts](../frontend/lib/api.ts) actually reads; both
  `.env.example` files un-ignored in [.gitignore](../.gitignore).
- **LICENSE**: MIT, added in `d1f55c5` ([LICENSE](../LICENSE)).
- **CI** (`d1f55c5`): [.github/workflows/ci.yml](../.github/workflows/ci.yml) runs frontend typecheck,
  lint, test and build on Node 22 and backend pytest on Python 3.11, on every push and pull request,
  with no database service.
- **Alembic fix** (`5e600ab`): `script_location` uses `%(here)s` so the documented
  `alembic -c backend/alembic.ini upgrade head` works from the repo root and from `backend/`.
- **gitignore** (`4e99f41`): `/.claude/` local launch config ignored.
- **Storage-key migration** (`d1f55c5`): the four `reportiq-*` localStorage keys became `redisense-*`
  with a one-time read-old-key shim, `readStorageWithLegacyFallback` in
  [frontend/lib/api.ts](../frontend/lib/api.ts), covered by
  [frontend/tests/storage.test.ts](../frontend/tests/storage.test.ts). Later keys follow the same pattern:
  `redisense-theme` (`5d82d18`, [frontend/lib/theme.ts](../frontend/lib/theme.ts)) and
  `redisense-sidebar-collapsed` (`d706c1d`,
  [frontend/components/providers/AppStateProvider.tsx](../frontend/components/providers/AppStateProvider.tsx)).
- **Dead code removed** (`4e99f41`): `apiClient.analyzeReportText` and `isAbortError` had no callers.
  `analyzeReportText` was restored in `fd12543` when the Report Analyzer gained a paste-text path
  against `/api/report/analyze`; `isAbortError` stays removed. `69056fa` deleted the six superseded
  dashboard cards (MetricCard, ReportsTable, AlertCard, InsightCard, RiskDistributionChart,
  RecentActivityPanel) from `frontend/features/shared/`.
- **Committed design source** (`5d82d18`): the five `design/*.dc.html` files from the 02:55 export.
  `design/RediSense Dashboard.dc.html` is a stale earlier canvas and is not a reference; the Dashboard
  lives in `design/RediSense Screens.dc.html`.

## 3. Backend

- **Dashboard summary endpoint** (`3f50443`): `GET /api/dashboard/summary` in
  [backend/api/dashboard_routes.py](../backend/api/dashboard_routes.py), built by
  `build_dashboard_summary` in
  [backend/services/dashboard_service.py](../backend/services/dashboard_service.py) from the existing
  patients, reports, triage_sessions, timeline_events and evidence tables. No new tables, no
  migration. Returns metrics, a report queue whose risk is derived from persisted safety flags,
  urgent alerts (High/Critical triage in a 7-day window plus patient alerts), a deterministic
  insight, risk distribution and recent activity. `DashboardSummary*` Pydantic schemas in
  [backend/db/schemas.py](../backend/db/schemas.py); router registered behind the optional auth
  dependency in [backend/main.py](../backend/main.py).
- **Series for the redesigned Dashboard** (`69056fa`): the same endpoint gained 7-day per-metric
  series with deltas (reports, High/Critical triage, Copilot answers citing a source), today's reports
  by risk with a weekly-baseline caption, modality mix, hourly throughput with a target line, queue
  rows with MRN and minutes in queue, and SLA-elapsed minutes on triage alerts. Fields the data cannot
  support come back as `null` with `TODO(backend)` comments naming the missing field (see section 9).
- **Record-count insight** (`4e99f41`): the insight carries `record_count`, so connected mode can say
  "Based on N records" instead of presenting a deterministic statistic as a confidence percentage.
- **Tests, 19 → 22** (`3f50443`, `4e99f41`, `69056fa`):
  [backend/tests/test_dashboard_routes.py](../backend/tests/test_dashboard_routes.py) covers the
  service and the HTTP route through `TestClient` with a `get_db` override.
- **FakeSession / FakeQuery** ([backend/tests/helpers.py](../backend/tests/helpers.py), `3f50443`,
  `69056fa`): the in-memory doubles gained `count`, `all`, `first`, `limit`, `filter` and `order_by`
  over Patient, Report, TriageSession, TimelineEvent, EvidenceDocument, EvidenceChunk and
  CopilotMessage, with `_sort_key` / `_compare` helpers.

## 4. Frontend architecture

- **Tokenisation** (`fd691c8`, B1): every inline Tailwind hex utility replaced with `--color-*` theme
  tokens. The commit records 343 occurrences in 25 files; a `[#hex]` regex over the baseline tree
  finds 408 bracketed values in those 25 files, some lines carrying several. After `fd691c8` the
  count is 0 and it is still 0 at `9d7e61e` outside `globals.css`. A computed-style fingerprint of
  all seven pages showed six identical and the Dashboard differing only in two AlertCard badges that
  had rendered white-on-pale because of class order.
- **`--rs-*` identity layer** (`fd691c8` B2, rewritten in `5d82d18`): tokens on `:root` (light) and
  `[data-theme="dark"]` (dark) in [frontend/app/globals.css](../frontend/app/globals.css); the Tailwind
  `@theme` block maps them onto utilities and keeps the legacy names (`bg-primary`, `text-risk-*`,
  `success` / `warning` / `danger`) as aliases so component churn stayed in `risk.ts` and
  `globals.css`. The `lg` breakpoint moved to 1025px (`d706c1d`) so the design's "1024px" notes hold.
- **Theme provider with no-flash script** (`5d82d18`):
  [frontend/lib/theme.ts](../frontend/lib/theme.ts) holds `ThemePreference`, `resolveTheme` and
  `THEME_INIT_SCRIPT`; [frontend/components/providers/ThemeProvider.tsx](../frontend/components/providers/ThemeProvider.tsx)
  is a `useSyncExternalStore` over the `<html>` attributes with System / Light / Dark. The inline
  script in [frontend/app/layout.tsx](../frontend/app/layout.tsx) sets `data-theme` before hydration
  (`<html suppressHydrationWarning>`). Toggle in the top bar (`5d82d18`) and Settings › Appearance
  (`770a975`).
- **next/font** (`5d82d18`): Nunito Sans and DM Mono loaded with `display: swap` in
  [frontend/app/layout.tsx](../frontend/app/layout.tsx); tabular numerals set globally.
- **Hydration fix** (`4e99f41`): `AppStateProvider` initialises demo mode, selected patient and
  triage drafts from defaults and reads localStorage in a mount effect, exposing `hydrated`. Pages
  and the Copilot drawer fetch only once hydrated, and persistence effects skip the pre-hydration
  render so defaults never overwrite stored values. This removed the demo-mode hydration mismatch.
- **AppStateProvider additions**
  ([frontend/components/providers/AppStateProvider.tsx](../frontend/components/providers/AppStateProvider.tsx)):
  `user {name, role}` (`fd691c8` B5; demo default Dr. A. Hernandez, read by the greeting, top bar and
  sidebar), `hydrated` (`4e99f41`), `copilotOpen` / `copilotPrefill` / `openCopilot` / `closeCopilot`
  (`d43a166`, so evidence cards can open the drawer), `pageHeader` / `setPageHeader` and
  `sidebarCollapsed` / `setSidebarCollapsed` (`d706c1d`).
- **lib/api.ts additions** ([frontend/lib/api.ts](../frontend/lib/api.ts)):
  `readStorageWithLegacyFallback` (`d1f55c5`), `apiClient.fetchDashboardSummary` with the existing
  `withDemoFallback` pattern (`3f50443`), `analyzeReportText` restored (`fd12543`).
  [frontend/lib/contracts.ts](../frontend/lib/contracts.ts) gained the `Dashboard*` response types
  (`3f50443`, `69056fa`) with nullable fields documented as "not available in connected mode".
- **View-models**: [frontend/features/dashboard/view-model.ts](../frontend/features/dashboard/view-model.ts)
  (`3f50443`, rewritten `69056fa`: `mapDashboardSummary`, `formatMinutes`, `formatActivityTime`),
  [frontend/features/timeline/view-model.ts](../frontend/features/timeline/view-model.ts) (`770a975`:
  `classifyEventType`, `groupByDay`, `dailyCounts`, `severityByDay`),
  [frontend/features/symptom-triage/vitals.ts](../frontend/features/symptom-triage/vitals.ts)
  (`fd12543`: `assessVitals`). Demo mode goes through the same render path via
  `buildDemoDashboardSummary` in [frontend/features/mock-data/dashboard.ts](../frontend/features/mock-data/dashboard.ts).
- **Copilot null-loading fix** (`b086adb`): with no prior conversations both `activeConversationId`
  and `loadingConversationId` were `null`, so [CopilotDrawer.tsx](../frontend/components/copilot/CopilotDrawer.tsx)
  showed "Loading conversation…" forever with Send disabled. The guard now compares the ids only
  when one is set.
- **Server/client boundary**: six of the seven pages and the Copilot drawer were already
  `"use client"` at `938b041` and stayed so. `DashboardPage.tsx` was a server component and became
  `"use client"` in `3f50443` when it started fetching the summary. `design/` is not imported
  anywhere (PR #1 body).

## 5. Design system

- **Token sheet** (`5d82d18`). The Phase 1 review read
  `design/RediSense Foundations.dc.html` v0.3 as 66 tokens (not the 68 the brief assumed) and diffed
  them against the `main` globals.css: 19 add, 15 update, 13 rename, 5 remove. Foundations' dark
  block overrides only 27 colour tokens and defines no dark elevation; the dark Screens artboards set
  elevation-1 to none and elevation-2 to a 1px `border-strong` ring plus a 24px accent glow, and
  those values were ported (documented in a comment in
  [globals.css](../frontend/app/globals.css); elevation-3 is inferred). The shipped sheet has 68
  `--rs-*` properties per theme: the 66 Foundations tokens plus the app's own `--rs-grid-line` and
  `--rs-grid-size` shell texture. Four values were changed for WCAG 4.5:1 (section 8).
  `npm run check:contrast` ([frontend/scripts/check-contrast.mjs](../frontend/scripts/check-contrast.mjs))
  prints the contrast table for both themes and fails under 4.5:1.
- **Severity scale with glyphs** ([frontend/features/shared/risk.ts](../frontend/features/shared/risk.ts),
  `fd691c8`, `5d82d18`): four levels mapped to `--rs-severity-*` with fill / soft / text / border /
  rail variants and a glyph shape per level (circle, triangle, diamond, octagon) so colour is never the
  only signal. Rendered by `SeverityGlyph` and `SeverityChip`.
- **Chart kit** ([frontend/components/charts/](../frontend/components/charts/), `fb24c12`). The Phase 1
  inventory counted 13 chart types and 56 instances per theme in the Screens export (137 `<svg>`
  tags: 1 sprite, 60 icon uses, 76 chart SVGs, plus 36 div-built instances). Eleven components cover
  them: Sparkline (also the BP range band and the risk-trend marker variant), DonutChart,
  HourlyAreaChart, SeverityStackedBar, SeverityGauge, ConfidenceRing (loading and error states),
  StepLine, Heatmap, HBarList, Stepper, EvidenceDots; `ChartStates` provides the loading and empty
  variants each chart exports. Rules obeyed: no library, token colours only, `<title>` and
  `aria-label` on every SVG, reserved heights, `useMeasuredWidth` (ResizeObserver), tabular numerals,
  reduced motion. Geometry lives in `math.ts` and is unit-tested in
  [frontend/tests/chart-math.test.ts](../frontend/tests/chart-math.test.ts).
- **Shared primitives** (14, as listed on the Phase 1 "Shared components" artboard; `fb24c12` unless
  noted), in [frontend/components/ui/](../frontend/components/ui/) and
  [frontend/features/shared/](../frontend/features/shared/):

| Primitive | File | Replaces / role |
|---|---|---|
| SeverityChip (+ SeverityGlyph) | `severity-chip.tsx`, `severity-glyph.tsx` | Badge `tone="none"` + risk classes |
| VerdictBlock | `features/shared/VerdictBlock.tsx` | rebuilt around SeverityGauge, polite live region, red-flag chips (`fd691c8` first version) |
| MrnChip | `mrn-chip.tsx` | new; in the top bar it opens the existing patient select in a popover (`d706c1d`) |
| CitationChip | `citation-chip.tsx` | EvidenceChips now render it |
| DisclaimerBar | `disclaimer-bar.tsx` | new, constant copy |
| TableToolbar | `table-toolbar.tsx` | new: search, filter chips, density |
| DataTable | `data-table.tsx` | generalises ReportsTable; sortable headers, keyboard-operable rows |
| PageHeader → top-bar slot | `features/shared/PageHeader.tsx` | registers title/context into the provider; TopNav renders it (`d706c1d`) |
| StatCard | `stat-card.tsx` | replaces MetricCard; embeds Sparkline |
| TimelineItem | `timeline-item.tsx` | new |
| EmptyState / ErrorState / Skeleton | `features/shared/PageStates.tsx`, `skeleton.tsx` | `fd691c8` (B3); flat blocks, shimmer dropped in `5d82d18` |
| ModeBadge | `mode-badge.tsx` | 4 app modes on 2 visual tones |
| SegmentedControl / ToggleSwitch | `segmented-control.tsx`, `toggle-switch.tsx` | new |
| Drawer | `components/copilot/CopilotDrawer.tsx` | restyled, `role="dialog"`, focus trap, Escape (`d43a166`), `inert` when closed (`384b320`) |

- **Type scale**: the design's sizes mapped onto Tailwind `text-*` utilities (`fb24c12`).

## 6. Pages

"Before" describes the page at `938b041`; "after" the page at `9d7e61e`. "Data source" says what
connected mode shows; demo-only parts render in demo mode and show an honest empty state in
connected mode with a `TODO(backend)` comment naming the missing field.

| Page | Before (`938b041`) | After | States added | Charts used | Data source |
|---|---|---|---|---|---|
| Dashboard [`DashboardPage.tsx`](../frontend/features/dashboard/DashboardPage.tsx) | greeting header, MetricCard row, ReportsTable, AlertCard, InsightCard, RiskDistributionChart, RecentActivityPanel; mock data in both modes | StatCard row with sparklines and deltas, "Today at a glance" hero, queue with TableToolbar (search, High + Critical filter, density), sortable DataTable with MRN / confidence ring / time in queue and pagination, hour-grouped activity, risk-distribution list, urgent alerts with SLA rings and Escalate chips, AI insight, DisclaimerBar (`3f50443`, `fd691c8`, `69056fa`) | skeleton, empty, error (`fd691c8`) | Sparkline (via StatCard), SeverityStackedBar, DonutChart, HourlyAreaChart, ConfidenceRing | connected: `GET /api/dashboard/summary`; median triage time, queue confidence and patient-alert SLA are `null` in connected mode (`dashboard_service.py` TODOs); demo: `buildDemoDashboardSummary` |
| Symptom Triage [`SymptomTriagePage.tsx`](../frontend/features/symptom-triage/SymptomTriagePage.tsx) | six-card intake form and a result panel | single intake form in the design order (severity slider with 0/10 labels, explicit red-flag checkbox group, vitals with in/out-of-range annotations from `vitals.ts`), result column with VerdictBlock, risk contributors, recommendations, reasoning, citations, DisclaimerBar (`fd691c8`, `fd12543`) | skeleton, empty (`fd12543`) | SeverityGauge + ConfidenceRing (via VerdictBlock), HBarList | connected: existing triage API, handlers and draft persistence unchanged; contributors demo-only (`mockTriageContributors`, TODO at line 555); confidence "Not reported" in connected mode |
| Report Analyzer [`ReportAnalyzerPage.tsx`](../frontend/features/report-analyzer/ReportAnalyzerPage.tsx) | seven cards around an upload flow; demo analysis shown before any submit | Source card with drop zone and paste-text textarea (`analyzeReportText` → `/api/report/analyze`), four-step stepper while loading, VerdictBlock, classification / summary / findings with severity glyph markers, recommendations, citations, structured data, DisclaimerBar (`fd691c8`, `fd12543`) | true empty state in both modes (`fd691c8`), loading stepper, error (`fd12543`) | Stepper, SeverityGauge + ConfidenceRing (via VerdictBlock) | connected: `/api/report/upload` and `/api/report/analyze`; connected results no longer borrow mock keywords or preview text; the stepper is a client-side timer over one request |
| Knowledge Center [`KnowledgeCenterPage.tsx`](../frontend/features/knowledge-center/KnowledgeCenterPage.tsx) | two cards: search and results | search with client-side Source / Section filters, result count and per-source facet line, score-badge evidence cards with `[n]` index, section, blockquote excerpt, "Ask Copilot about this" and "Open source", `?query=` deep link run after hydration (`fd691c8`, `d43a166`) | skeleton, empty, filtered-empty, error (`fd691c8`, `d43a166`) | none | connected: existing evidence search; no Date filter because chunks carry no publication date |
| Patient Profile [`PatientProfilePage.tsx`](../frontend/features/patient-profile/PatientProfilePage.tsx) | nine cards | header with initials avatar, MrnChip, allergy badge, primary clinician and a risk-trend dot line from the patient's triage events; demographics grid; active conditions; vitals history; recent reports DataTable; recent triage sessions; alerts and tasks; also loads the timeline (`fd691c8`, `770a975`) | skeleton, empty, error (`fd691c8`) | Sparkline (risk trend markers; vitals series) | connected: patient, reports and timeline APIs; insurance / language "Not recorded", condition onset years demo-only, vitals history demo-only (`mockVitalsHistory`; TODOs at lines 134, 202, 223, 260) |
| Timeline [`TimelinePage.tsx`](../frontend/features/timeline/TimelinePage.tsx) | two cards: header and a flat event list | All / Reports / Triage / Copilot / Alerts filter chips, day grouping (Today / Yesterday), time-gutter TimelineItems with risk glyphs and findings, sticky right rail with a 30-day activity heatmap and a 7-day severity step line (`fd691c8`, `770a975`) | skeleton, empty, error (`fd691c8`) | Heatmap, StepLine | connected: existing timeline API; heatmap and step line are derived client-side in `timeline/view-model.ts` from the loaded events |
| Settings [`SettingsPage.tsx`](../frontend/features/settings/SettingsPage.tsx) | five cards under "Settings & Integrations" | Connection card (client-measured `/health` latency sparkline, sync ring, Demo / Connected ToggleSwitch, API base URL), read-only Model & RAG config DataTable from `/api/system/config`, retrieval-mix donut, Appearance Light / Dark / System SegmentedControl wired to the theme provider, data retention and about cards (`fd691c8`, `770a975`) | none of the shared page states; latency shows an empty sparkline until probes return | Sparkline, ConfidenceRing, DonutChart | connected: `/health` probes and `/api/system/config`; chunk size / overlap and minimum citation confidence "Not exposed" (TODO line 68); retrieval mix demo-only (TODO line 149); retention rows describe current behaviour (line 176) |
| Copilot drawer [`CopilotDrawer.tsx`](../frontend/components/copilot/CopilotDrawer.tsx) | side panel with a conversation list and composer | `role="dialog"` with `aria-modal`, focus moves in on open, Tab trapped, Escape closes, focus returns to the opener; context line with MrnChip, ModeBadge on messages, inline `[n]` refs mapped to a Sources panel with score rings, `insufficient_evidence` rendered as a first-class notice, suggested prompts, DisclaimerBar (`b086adb`, `d43a166`, `384b320`) | loading guard fixed (`b086adb`), insufficient-evidence notice | ConfidenceRing | connected: existing Copilot API; no attachment button because chat has no attachment endpoint |

Shell (`d706c1d`): full-bleed layout with a skip-to-content link; 240px sidebar with wordmark,
accent-050 active state, 18px stroke-1.6 icons and a footer user block, collapsing to a 64px rail
with native tooltips (manual toggle persisted; forced at 1024px and below); 64px top bar with the
page title slot, a Knowledge Center search pill with a real Cmd/Ctrl+K shortcut, theme toggle,
MrnChip patient selector, mode badge, page-scoped "New report", filled Copilot button and avatar
initials. The drawer becomes a full-width overlay below 1024px.

## 7. Quality and accessibility

All figures are from the PR #1 body, measured on the production build (`next build && next start`).

**Lighthouse desktop**

| Route | Performance | Accessibility | Best practices | LCP | CLS | TBT |
|---|---|---|---|---|---|---|
| Dashboard | 98 | 100 | 100 | 1.2 s | 0.001 | 0 ms |
| Symptom Triage | 100 | 100 | 100 | 0.6 s | 0.015 | — |
| Report Analyzer | 100 | 100 | 100 | 0.6 s | 0.001 | — |

**Interaction latency** (measured in-page, interaction to next paint): theme switch 31 ms, table
sort 54 ms, queue filter 61 ms.

**axe-core**: 0 serious or critical violations on 56 renders (7 routes × light/dark × demo/connected
× 1440/1024) via [frontend/scripts/verify.mjs](../frontend/scripts/verify.mjs). `384b320` fixed the
three findings that pass required: the closed drawer is `inert` (aria-hidden-focus), `<main>` has
`tabIndex=0` (scrollable-region-focusable), and the top-bar search and patient buttons use `title`
so the accessible name contains the visible text (label-content-name-mismatch).

**Contrast** (WCAG ratio, both themes; `npm run check:contrast`):

| Pair | Light | Dark |
|---|---|---|
| severity-low chip (ink on tint) | 4.86 | 6.89 |
| severity-moderate chip | 4.93 | 7.82 |
| severity-high chip | 4.88 | 6.12 |
| severity-critical chip | 6.45 | 5.19 |
| severity ink on surface (low / moderate / high / critical) | 5.58 / 5.69 / 5.81 / 7.79 | 9.05 / 10.43 / 7.69 / 6.29 |
| ink-900 / ink-700 / ink-500 on surface | 18.72 / 10.27 / 6.96 | 14.77 / 11.14 / 7.89 |
| ink-400 captions on surface / surface-sunken | 5.39 / 4.79 | 5.03 / 5.23 |
| ink-on-accent on solid buttons (accent-700) | 5.47 | 7.52 |
| accent-700 links / active nav on accent-050 | 5.47 / 5.25 | 6.99 / 6.03 |

**Theme**: no flash on hard reload (0 mismatches across 56 loads), 0 hydration warnings, System
follows `prefers-color-scheme` through `matchMedia`.

**Keyboard**: tab order skip link → sidebar → top bar → page content → table rows; the drawer traps
Tab (12 of 12 stops inside), Escape closes the drawer and the patient popover, focus returns to the
opener. Focus rings use `--rs-border-focus` ([globals.css](../frontend/app/globals.css)).

**Reduced motion**: with `prefers-reduced-motion: reduce` every transition collapses to 0.01 ms
(chart needle, ring arcs, bar widths) through the global rule in `globals.css`.

**Bundle**, gzipped client JS loaded per route on a cold navigation
([frontend/scripts/route-js.mjs](../frontend/scripts/route-js.mjs)):

| Route | Before (`main`) | After | Δ |
|---|---|---|---|
| / | 143.2 KB | 153.7 KB | +10.5 KB |
| /report-analyzer | 147.0 KB | 154.0 KB | +7.0 KB |
| /symptom-triage | 149.0 KB | 156.6 KB | +7.6 KB |
| /patient-profile | 140.0 KB | 149.7 KB | +9.7 KB |
| /timeline | 140.0 KB | 148.3 KB | +8.3 KB |
| /knowledge-center | 140.1 KB | 146.8 KB | +6.7 KB |
| /settings | 138.4 KB | 148.1 KB | +9.7 KB |

No runtime dependency was added; `tsx` is the only new devDependency in
[frontend/package.json](../frontend/package.json) (`fb24c12`). `playwright-core`, `axe-core` and
`lighthouse` were run through `npx` for the verification scripts.

**Tests**

| Suite | `938b041` | `9d7e61e` | Added |
|---|---|---|---|
| Frontend (`node --test` through `tsx`) | 5 (1 failing: stale `usedInAnswer` assertion, fixed in `d1f55c5`) | 34 | storage (`d1f55c5`), dashboard view-model and api-client demo case (`3f50443`), risk (`fd691c8`), theme (`5d82d18`), chart-math and components: VerdictBlock, SeverityChip, TableToolbar, ModeBadge, chart a11y (`fb24c12`), vitals (`fd12543`), timeline view-model (`770a975`) |
| Backend (pytest) | 19 | 22 | dashboard service and route (`3f50443`, `4e99f41`, `69056fa`) |

Both counts were re-run for this document: frontend 34 pass, backend 22 pass at `9d7e61e`; a
detached worktree at `938b041` collected 19 backend tests and ran 5 frontend tests with 1 failure.

**Screenshots** (`9d7e61e`): [docs/screenshots/](./screenshots/) holds the eight README images
(Dashboard, Report Analyzer and Copilot in dark mode, the rest light), `before/` the seven
`main` pages, and `matrix/` every page in both themes at 1440 and 1024 plus the Copilot drawer,
all captured from the production build by `verify.mjs` and
[frontend/scripts/copilot-shot.mjs](../frontend/scripts/copilot-shot.mjs).

## 8. Intentional deviations from the design

| Design element | What shipped | Why |
|---|---|---|
| Foundations severity-low / severity-moderate lightness, ink-400, white text on accent-600 buttons | severity-low 52 % → 50 %, severity-moderate 56 % → 51 %, ink-400 darkened in both themes, solid buttons use accent-700 (`5d82d18`, comments in `globals.css`) | The Foundations values failed WCAG 4.5:1; white on accent-600 is 3.74:1 |
| Skeleton shimmer | flat blocks (`5d82d18`) | The design forbids shimmer; approved decision 7 |
| Dark elevation | ported from the Screens artboards; elevation-3 inferred | Foundations defines no dark elevation; approved decision 8 |
| Sidebar nav badges (Dashboard 4, Report Analyzer 3) | omitted (`d706c1d`) | No global count source; the dashboard summary is page-scoped and adding one would mean a provider-level fetch on every route |
| Top-bar bell | omitted | No notifications backend; a dead icon would be fake UI |
| Per-page primary action (Save session / Analyze) | "New report" on Dashboard, Triage and Analyzer; hidden elsewhere | Triage and Analyzer have no separate save action; their in-page buttons submit |
| Read-only patient chip | MrnChip opens the existing patient select in a popover; no risk glyph on the chip | Selection must keep working (approved decision 3); the shell has no per-patient risk source |
| Mode badge with 2 states | 4 app modes on 2 tones: fallback = connected tone + tooltip, error = critical dot | Approved decision 2 |
| Metric "Median triage time" | "—" with "Not available — needs triage duration" | Triage sessions store no start/end time |
| Queue confidence rings | ring track with "–" in connected mode | The analyzer does not score confidence |
| Alert SLA rings for patient-level alerts | ring without elapsed time | Patient alerts carry no timestamp; triage alerts do |
| Triage risk contributors bar list and confidence 0.86 | demo-only; connected shows "Not available — needs contributor weights" and "Not reported" | The rule engine exposes no weights and urgency is not a probability |
| Analyzer accepted formats "PDF, PNG, DICOM SR" and a Report type dropdown | "PDF, TXT, MD, DOCX up to 10MB"; no dropdown | Matches what `/api/report/upload` accepts; classification is inferred |
| Analyzer 4-step stepper | client-side timer over one request | The API is a single call |
| Knowledge Center Date filter and guideline / review / trial facets | Source and Section filters; facets count by source | Chunks carry no publication date or document type |
| Copilot attachment button | omitted | No attachment endpoint |
| Profile insurance, language and condition onset years | "Not recorded"; conditions show "onset not recorded" | Not in the patient model |
| Profile vitals history sparklines | demo-only | No vitals series table |
| Settings latency sparkline | client-measured `/health` probes on page load | The backend keeps no latency history |
| Settings config rows (chunk size, minimum confidence) | "Not exposed" | `/api/system/config` does not expose them |
| Settings retrieval-mix donut | demo-only | Retrieval mode exists only per query in `rag_trace` |
| Settings retention values (90 days, 7 years) | rows describe current behaviour | Retention is not configurable; policy numbers would be untrue |
| Design names (Dr. A. Reyes, Okafor, Daniel) | app user and seeded patients | Approved decision 5 |
| Design icon sprite | lucide at 18px / stroke 1.6 kept (Phase 1 chart inventory note) | Nav icon semantics map 1:1; porting the sprite would add no information |
| Phase 1 plan: timeline heatmap from a 30-day aggregate in the timeline API | computed client-side from loaded events in `timeline/view-model.ts` (`770a975`) | No API change was needed for the current page size |

## 9. Known gaps and follow-ups

Backend fields the demo-only cards are waiting for (each site carries a `TODO(backend)` comment):

| Field | Where it is needed | Comment |
|---|---|---|
| `triage_sessions.duration_seconds` | Dashboard "Median triage time" | [dashboard_service.py:204](../backend/services/dashboard_service.py#L204) |
| `reports.confidence` | Dashboard queue confidence rings | [dashboard_service.py:284](../backend/services/dashboard_service.py#L284) |
| timestamp on patient alerts | Dashboard alert SLA clock | [dashboard_service.py:319](../backend/services/dashboard_service.py#L319) |
| `TriageAnalyzeResponse.contributors [{label, weight}]` | Triage risk contributors | [SymptomTriagePage.tsx:555](../frontend/features/symptom-triage/SymptomTriagePage.tsx#L555) |
| `ReportListItem.risk` | Profile recent reports risk column | [PatientProfilePage.tsx:134](../frontend/features/patient-profile/PatientProfilePage.tsx#L134) |
| `patients.insurance`, `patients.language` | Profile demographics | [PatientProfilePage.tsx:202](../frontend/features/patient-profile/PatientProfilePage.tsx#L202) |
| condition onset / resolved dates | Profile conditions year axis | [PatientProfilePage.tsx:223](../frontend/features/patient-profile/PatientProfilePage.tsx#L223) |
| vitals table (`patient_id, taken_at, systolic, diastolic, hr, spo2`) | Profile vitals history | [PatientProfilePage.tsx:260](../frontend/features/patient-profile/PatientProfilePage.tsx#L260) |
| chunk size / overlap, minimum citation confidence on `/api/system/config` | Settings config table | [SettingsPage.tsx:68](../frontend/features/settings/SettingsPage.tsx#L68) |
| aggregate retrieval-mode counts | Settings retrieval-mix donut | [SettingsPage.tsx:149](../frontend/features/settings/SettingsPage.tsx#L149) |
| configurable retention policy | Settings data retention card | [SettingsPage.tsx:176](../frontend/features/settings/SettingsPage.tsx#L176) |

Other open items:

- **Hydration**: `4e99f41` removed the mismatch warning by rendering defaults first and reading
  localStorage in a mount effect. The cost is one client render with default demo-mode / patient /
  sidebar state before the stored values apply, and data fetches start only after `hydrated`
  flips.
- **Settings fetches directly**: the `/health` latency probe in
  [SettingsPage.tsx](../frontend/features/settings/SettingsPage.tsx) calls `fetch` inside the page
  rather than going through `lib/api.ts`; the rest of the app fetches only through the client.
- **EvidenceDots** ([frontend/components/charts/EvidenceDots.tsx](../frontend/components/charts/EvidenceDots.tsx))
  is exported and tested but no page renders it; the Phase 1 inventory listed it as "specimens only".
- **Stale design canvas**: `design/RediSense Dashboard.dc.html` was committed with the rest of the
  export in `5d82d18` and should not be used as a reference.
- **No user endpoint**: `user` in `AppStateProvider` is a constant (`fd691c8`); there is no identity
  API behind it.
- **Evidence source label** "ReportIQ curated local dataset" and its fixtures were kept on purpose
  in `d1f55c5` and remain.
- **Verification is scripted, not in CI**: `verify.mjs`, `route-js.mjs` and the Lighthouse runs need
  an installed Google Chrome and a production server, so they run locally, not in
  [ci.yml](../.github/workflows/ci.yml).
