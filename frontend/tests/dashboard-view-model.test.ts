import test from "node:test";
import assert from "node:assert/strict";

import { formatActivityTime, formatMinutes, mapDashboardSummary } from "../features/dashboard/view-model.ts";
import { buildDemoDashboardSummary } from "../features/mock-data/dashboard.ts";
import type { DashboardSummaryResponse } from "../lib/contracts.ts";

const now = new Date("2026-09-16T10:00:00Z");

const summary: DashboardSummaryResponse = {
  ...buildDemoDashboardSummary(),
  metrics: [
    { id: "reports-today", label: "Reports today", value: "3", unit: null, trend: "up", trend_label: "vs. 7-day avg 2", delta: { direction: "up", label: "+50%" }, series: [1, 2, 2, 3, 1, 2, 3], footnote: "12 on record", pill: null, secondary: null },
    { id: "high-risk", label: "High / Critical risk", value: "2", unit: null, trend: "down", trend_label: "x", delta: { direction: "up", label: "+1" }, series: null, footnote: null, pill: null, secondary: { value: "1", label: "critical", tone: "Critical" } },
    { id: "triage-time", label: "Median triage time", value: null, unit: "min", trend: "neutral", trend_label: "Not available", delta: null, series: null, footnote: "Not available — needs triage duration", pill: null, secondary: null },
  ],
  reports_queue: [
    { id: "10", patient_name: "Lien Nguyen", patient_id: "MRN 184920", mrn: null, modality: "CT chest", summary: "Nodule enlarged.", risk: "High", confidence: null, received_at: "2026-09-16T08:12:00Z", minutes_in_queue: 108 },
  ],
  urgent_alerts: [
    { id: "triage-1", label: "Critical risk triage", patient_name: "Samir Ali", detail: "Emergency evaluation now.", severity: "Critical", elapsed_minutes: 24, sla_minutes: 30 },
    { id: "patient-1-a1", label: "Nodule surveillance", patient_name: "Lien Nguyen", detail: "Follow-up overdue.", severity: "High", elapsed_minutes: null, sla_minutes: 30 },
  ],
  ai_insight: { id: "i", title: "T", summary: "S", confidence: 100, record_count: 5 },
  risk_distribution: [
    { label: "Low", value: 4 },
    { label: "Moderate", value: 1 },
    { label: "High", value: 0 },
    { label: "Critical", value: 2 },
  ],
  recent_activity: [
    { id: "30", timestamp: "2026-09-16T09:41:00Z", label: "Report uploaded", detail: "CT chest", event_type: "report_uploaded", patient_id: 1, patient_name: "Lien Nguyen" },
    { id: "31", timestamp: "2026-09-16T09:05:00Z", label: "Triage completed", detail: "Cough", event_type: "triage_completed", patient_id: 1, patient_name: "Lien Nguyen" },
    { id: "32", timestamp: "2026-09-10T08:00:00Z", label: "Medication change", detail: "x", event_type: "medication_change", patient_id: 1, patient_name: null },
  ],
};

test("dashboard view model maps metrics honestly, including unavailable ones", () => {
  const view = mapDashboardSummary(summary, now);
  assert.equal(view.metrics[0]?.value, "3");
  assert.deepEqual(view.metrics[0]?.series, [1, 2, 2, 3, 1, 2, 3]);
  assert.equal(view.metrics[0]?.delta?.tone, "accent");
  assert.equal(view.metrics[1]?.delta?.tone, "Critical"); // more high-risk is bad
  assert.equal(view.metrics[1]?.secondary?.tone, "Critical");
  assert.equal(view.metrics[2]?.value, "—");
  assert.equal(view.metrics[2]?.unit, undefined);
  assert.equal(view.metrics[2]?.series, undefined);
  assert.match(view.metrics[2]?.footnote ?? "", /Not available/);
});

test("queue, alerts, distribution and activity groups map onto the primitives", () => {
  const view = mapDashboardSummary(summary, now);
  assert.equal(view.queue[0]?.mrn, "184920"); // derived from the legacy patient_id label
  assert.equal(view.queue[0]?.confidence, null);
  assert.equal(view.queue[0]?.minutesInQueue, 108);
  assert.equal(view.alerts[0]?.slaPercent, 80);
  assert.equal(view.alerts[1]?.slaPercent, null);
  assert.deepEqual(view.riskDistribution.map((b) => b.value), [4, 1, 0, 2]);
  assert.equal(view.modality[0]?.opacity, 1);
  assert.equal(view.modality[1]?.opacity, 0.65);
  assert.equal(view.insight.basis, "Based on 5 records");
  assert.deepEqual(view.activity.map((g) => [g.hour, g.items.length]).slice(0, 1), [[`${formatActivityTime("2026-09-16T09:41:00Z", now).slice(0, 2)}:00`, 2]]);
  assert.match(view.activity[0]?.items[0]?.title ?? "", /Lien Nguyen — Report uploaded/);
  assert.equal(view.activity[0]?.items[0]?.type, "report");
});

test("demo snapshot maps without a basis label and formats elapsed minutes", () => {
  const demo = mapDashboardSummary(buildDemoDashboardSummary(), now);
  assert.equal(demo.insight.basis, undefined);
  assert.equal(demo.queue.length, 5);
  assert.equal(formatMinutes(3), "3m");
  assert.equal(formatMinutes(125), "2h 5m");
  assert.equal(formatMinutes(3000), "2d");
  assert.equal(formatMinutes(null), "—");
  assert.equal(formatActivityTime(null, now), "—");
  assert.equal(formatActivityTime("not-a-date", now), "—");
});
