import test from "node:test";
import assert from "node:assert/strict";

import { formatActivityTime, mapDashboardSummary } from "../features/dashboard/view-model.ts";
import type { DashboardSummaryResponse } from "../lib/contracts.ts";

const now = new Date("2026-09-16T10:00:00Z");

const summary: DashboardSummaryResponse = {
  generated_at: now.toISOString(),
  risk_window_days: 7,
  metrics: [
    {
      id: "reports-today",
      label: "Reports analyzed today",
      value: "3",
      trend: "up",
      trend_label: "12 on record",
      pill: null,
    },
  ],
  reports_queue: [
    {
      id: "10",
      patient_name: "Lien Nguyen",
      patient_id: "MRN 184920",
      modality: "CT chest",
      summary: "Nodule enlarged.",
      risk: "High",
      received_at: "2026-09-16T08:12:00Z",
    },
  ],
  urgent_alerts: [
    {
      id: "triage-1",
      label: "Critical risk triage",
      patient_name: "Samir Ali",
      detail: "Emergency evaluation now.",
      severity: "Critical",
    },
  ],
  ai_insight: { id: "i", title: "T", summary: "S", confidence: 100, record_count: 5 },
  risk_distribution: [
    { label: "Low", value: 4 },
    { label: "Moderate", value: 1 },
    { label: "High", value: 0 },
    { label: "Critical", value: 2 },
  ],
  recent_activity: [
    {
      id: "30",
      timestamp: "2026-09-10T08:00:00Z",
      label: "Report uploaded",
      detail: "CT chest",
      event_type: "report_uploaded",
      patient_id: 1,
    },
  ],
  disclaimer: "Clinical decision support only.",
  mode: "real",
};

test("dashboard view model maps the backend summary onto the shared card props", () => {
  const view = mapDashboardSummary(summary, now);

  assert.equal(view.metrics[0]?.trendLabel, "12 on record");
  assert.equal(view.metrics[0]?.pill, undefined);
  assert.equal(view.reportsQueue[0]?.patientName, "Lien Nguyen");
  assert.equal(view.reportsQueue[0]?.risk, "High");
  assert.equal(view.urgentAlerts[0]?.patientName, "Samir Ali");
  assert.equal(view.aiInsight.confidence, 100);
  assert.equal(view.aiInsight.basis, "Based on 5 records");
  assert.equal(
    mapDashboardSummary({ ...summary, ai_insight: { ...summary.ai_insight, record_count: null } }, now)
      .aiInsight.basis,
    undefined,
  );
  assert.deepEqual(
    view.riskDistribution.map((bucket) => bucket.value),
    [4, 1, 0, 2],
  );
  assert.ok(view.riskDistribution.every((bucket) => bucket.color.startsWith("bg-")));
  assert.equal(view.recentActivity[0]?.label, "Report uploaded");
});

test("activity time shows a clock for today and a date otherwise", () => {
  assert.match(formatActivityTime("2026-09-16T08:12:00Z", now), /\d{1,2}:\d{2}/);
  assert.doesNotMatch(formatActivityTime("2026-09-10T08:00:00Z", now), /:\d{2}/);
  assert.equal(formatActivityTime(null, now), "—");
  assert.equal(formatActivityTime("not-a-date", now), "—");
});
