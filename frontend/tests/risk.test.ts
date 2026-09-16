import test from "node:test";
import assert from "node:assert/strict";

import {
  isEscalationLevel,
  normalizeRiskLevel,
  riskClasses,
  riskSolidBadgeClasses,
} from "../features/shared/risk.ts";

test("risk levels normalise backend and care-level spellings", () => {
  assert.equal(normalizeRiskLevel("low"), "Low");
  assert.equal(normalizeRiskLevel("MODERATE"), "Moderate");
  assert.equal(normalizeRiskLevel("urgent"), "High");
  assert.equal(normalizeRiskLevel("Emergency"), "Critical");
  assert.equal(normalizeRiskLevel("unknown"), null);
  assert.equal(normalizeRiskLevel(null), null);
});

test("risk classes map onto the --rs-risk-* utilities", () => {
  assert.equal(riskClasses("High").bar, "bg-risk-high");
  assert.equal(riskClasses("Critical").badge, "bg-risk-critical-soft text-risk-critical-text");
  assert.equal(riskClasses(null).bar, "bg-risk-low");
  assert.equal(riskSolidBadgeClasses("Critical"), "bg-risk-critical text-white");
});

test("only High and Critical are escalation levels", () => {
  assert.equal(isEscalationLevel("High"), true);
  assert.equal(isEscalationLevel("Critical"), true);
  assert.equal(isEscalationLevel("Moderate"), false);
  assert.equal(isEscalationLevel(null), false);
});
