import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { SeverityChip } from "../components/ui/severity-chip";
import { TableToolbar } from "../components/ui/table-toolbar";
import { ModeBadge } from "../components/ui/mode-badge";
import { SeverityGauge } from "../components/charts/SeverityGauge";
import { ConfidenceRing } from "../components/charts/ConfidenceRing";
import { SeverityStackedBar } from "../components/charts/SeverityStackedBar";
import { VerdictBlock } from "../features/shared/VerdictBlock";

test("SeverityChip renders the level with its glyph and severity tokens", () => {
  const html = renderToStaticMarkup(<SeverityChip level="High" />);
  assert.match(html, /bg-severity-high-bg text-severity-high/);
  assert.match(html, /rotate-45/); // diamond glyph
  assert.match(html, />High</);
  const solid = renderToStaticMarkup(<SeverityChip level="Critical" variant="solid" label="Escalate" />);
  assert.match(solid, /bg-severity-critical text-ink-on-accent/);
  assert.match(solid, />Escalate</);
  const unknown = renderToStaticMarkup(<SeverityChip level={null} />);
  assert.match(unknown, />Unknown</);
});

test("VerdictBlock is a polite live region that states severity, confidence and escalation", () => {
  const html = renderToStaticMarkup(
    <VerdictBlock severityLabel="Risk level" severity="Critical" secondary="Care level: Emergency" confidence={86} escalate redFlags={["Chest pain radiating to left arm", "Diaphoresis"]} basis="Rule-based urgency" mode="real" />,
  );
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-label="Risk level Critical\. Confidence 86 percent\. Escalation recommended\."/);
  assert.match(html, /Escalation recommended/);
  assert.match(html, /Red flags/);
  assert.match(html, /Diaphoresis/);
  assert.match(html, /border-l-severity-critical/);
  assert.match(html, /Connected/);

  const none = renderToStaticMarkup(<VerdictBlock severity="Low" confidence={null} escalate={false} mode="demo" />);
  assert.match(none, /Not reported/);
  assert.match(none, /No escalation flag/);
  assert.match(none, /Demo/);
});

test("TableToolbar exposes search, pressed filters and a density control", () => {
  const html = renderToStaticMarkup(
    <TableToolbar
      searchValue="nguyen"
      searchPlaceholder="Search patient or MRN"
      onSearchChange={() => {}}
      filters={[{ id: "hc", label: "High + Critical", active: true }, { id: "today", label: "Today", active: false }]}
      onToggleFilter={() => {}}
      density="compact"
      onDensityChange={() => {}}
    />,
  );
  assert.match(html, /type="search"/);
  assert.match(html, /value="nguyen"/);
  assert.match(html, /aria-pressed="true"[^>]*>High \+ Critical/);
  assert.match(html, /aria-pressed="false"[^>]*>Today/);
  assert.match(html, /1 filters active/);
  assert.match(html, /Density: <span[^>]*>Compact/);
});

test("ModeBadge maps the four app modes onto two visual states", () => {
  assert.match(renderToStaticMarkup(<ModeBadge mode="real" />), /bg-accent-500[^]*Connected/);
  assert.match(renderToStaticMarkup(<ModeBadge mode="fallback" />), /heuristic fallback[^]*Connected/);
  assert.match(renderToStaticMarkup(<ModeBadge mode="demo" />), /bg-ink-300[^]*Demo/);
  assert.match(renderToStaticMarkup(<ModeBadge mode="error" />), /bg-severity-critical[^]*Error/);
});

test("charts carry titles, labels and token colours only", () => {
  const gauge = renderToStaticMarkup(<SeverityGauge level="High" title="Urgency" />);
  assert.match(gauge, /<title>Urgency: High<\/title>/);
  assert.match(gauge, /role="img" aria-label="Urgency: High"/);
  assert.doesNotMatch(gauge, /#[0-9a-fA-F]{6}/);
  const ring = renderToStaticMarkup(<ConfidenceRing value={86} size={34} title="Confidence" />);
  assert.match(ring, /aria-label="Confidence: 86"/);
  const ringNull = renderToStaticMarkup(<ConfidenceRing value={null} title="Confidence" />);
  assert.match(ringNull, /not reported/);
  const bar = renderToStaticMarkup(<SeverityStackedBar buckets={[{ level: "Low", value: 52 }, { level: "Critical", value: 7 }]} title="Reports by risk" />);
  assert.match(bar, /aria-label="Reports by risk: Low 52, Moderate 0, High 0, Critical 7"/);
  assert.match(bar, /width:88%/);
});
