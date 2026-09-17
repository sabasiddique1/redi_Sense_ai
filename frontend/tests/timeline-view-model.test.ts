import test from "node:test";
import assert from "node:assert/strict";

import { dailyCounts, eventRisk, groupByDay, mapTimelineEvent, severityByDay } from "../features/timeline/view-model.ts";

const now = new Date(2026, 8, 16, 12, 0, 0);
const at = (daysAgo: number, hour = 9) => new Date(2026, 8, 16 - daysAgo, hour, 0, 0).toISOString();

const events = [
  { id: 1, patient_id: 1, event_type: "triage_completed", title: "Triage: Critical risk", summary: "x", metadata: { risk_level: "Critical" }, timestamp: at(0, 8) },
  { id: 2, patient_id: 1, event_type: "report_uploaded", title: "CT chest uploaded", summary: "y", metadata: {}, timestamp: at(0, 7) },
  { id: 3, patient_id: 1, event_type: "triage_completed", title: "Triage: High risk", summary: "z", metadata: {}, timestamp: at(1) },
  { id: 4, patient_id: 1, event_type: "medication_change", title: "Medication change", summary: "m", metadata: {}, timestamp: at(40) },
].map(mapTimelineEvent);

test("events classify, read risk from metadata or title, and group by day", () => {
  assert.equal(events[0].type, "triage");
  assert.equal(events[0].risk, "Critical");
  assert.equal(events[2].risk, "High");
  assert.equal(events[1].filter, "report");
  const groups = groupByDay(events, now);
  assert.match(groups[0].label, /^Today — /);
  assert.equal(groups[0].events.length, 2);
  assert.match(groups[1].label, /^Yesterday — /);
});

test("daily counts and severity-by-day windows are honest about out-of-range events", () => {
  const heat = dailyCounts(events, 30, now);
  assert.equal(heat.values.length, 30);
  assert.equal(heat.values.reduce((s, v) => s + v, 0), 3); // the 40-day-old event is excluded
  const sev = severityByDay(events, 7, now);
  assert.equal(sev.length, 7);
  assert.equal(sev[6].level, "Critical");
  assert.equal(sev[5].level, "High");
  assert.equal(sev[0].level, null);
  assert.equal(eventRisk({ id: 9, patient_id: 1, event_type: "x", title: "Nothing here", summary: "", metadata: {}, timestamp: at(0) }), null);
});
