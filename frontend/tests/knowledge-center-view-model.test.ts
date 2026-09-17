import test from "node:test";
import assert from "node:assert/strict";

import { buildEmptyStateMessage, mapEvidenceSources } from "../features/knowledge-center/view-model.ts";


test("knowledge center view model maps real evidence sources for rendering", () => {
  const items = mapEvidenceSources([
    {
      id: "doc-1",
      title: "Pulmonary Nodule Follow-up Primer",
      snippet: "Solid pulmonary nodules that increase in size should be treated as higher risk.",
      source: "ReportIQ curated local dataset",
      url: "https://example.local/evidence/pulmonary-nodule-follow-up",
      section: "Pulmonary nodules",
      page: null,
      score: 0.92,
    },
  ]);

  assert.equal(items.length, 1);
  assert.equal(items[0]?.title, "Pulmonary Nodule Follow-up Primer");
  assert.equal(items[0]?.usedInAnswer, false);
  assert.equal(items[0]?.section, "Pulmonary nodules");
  assert.equal(items[0]?.score, 0.92);
});

test("knowledge center empty state stays truthful in connected-mode failures", () => {
  assert.equal(
    buildEmptyStateMessage("error", "pulmonary nodule"),
    "Evidence search is unavailable in connected mode. Restore the backend service or enable demo mode explicitly.",
  );
  assert.equal(
    buildEmptyStateMessage("real", "pulmonary nodule"),
    "No evidence matched this query in the current local index.",
  );
});
