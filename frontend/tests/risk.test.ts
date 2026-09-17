import test from "node:test";
import assert from "node:assert/strict";

import {
  isEscalationLevel,
  normalizeRiskLevel,
  riskClasses,
  riskIndex,
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

test("risk classes map onto the --rs-severity-* utilities and carry a glyph", () => {
  assert.equal(riskClasses("High").bar, "bg-severity-high");
  assert.equal(riskClasses("Critical").badge, "bg-severity-critical-bg text-severity-critical");
  assert.equal(riskClasses(null).bar, "bg-severity-low");
  assert.equal(riskSolidBadgeClasses("Critical"), "bg-severity-critical text-ink-on-accent");
  assert.deepEqual(
    ["Low", "Moderate", "High", "Critical"].map((l) => riskClasses(l as "Low").glyph),
    ["circle", "triangle", "diamond", "octagon"],
  );
  assert.equal(riskIndex("High"), 2);
  assert.equal(riskIndex(null), 0);
});

test("only High and Critical are escalation levels", () => {
  assert.equal(isEscalationLevel("High"), true);
  assert.equal(isEscalationLevel("Critical"), true);
  assert.equal(isEscalationLevel("Moderate"), false);
  assert.equal(isEscalationLevel(null), false);
});
