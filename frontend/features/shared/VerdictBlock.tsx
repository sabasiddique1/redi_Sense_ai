import { ShieldAlert, ShieldCheck } from "lucide-react";

import { ConfidenceRing } from "@/components/charts/ConfidenceRing";
import { SeverityGauge } from "@/components/charts/SeverityGauge";
import { CitationChip } from "@/components/ui/citation-chip";
import { SeverityChip } from "@/components/ui/severity-chip";
import { cn } from "@/components/ui/cn";
import { ModeBadge } from "@/components/ui/mode-badge";
import type { ResultMode } from "@/lib/contracts";
import { riskClasses, type RiskLevel } from "./risk";

export type VerdictBlockProps = {
  severityLabel?: string;
  severity: RiskLevel | null;
  /** Shown under the severity, e.g. the care level or the predicted category. */
  secondary?: string | null;
  /** Percent, or null when the pipeline does not report one. */
  confidence: number | null;
  confidenceNote?: string;
  escalate: boolean;
  escalationText?: string;
  /** Explicit red flags rendered as chips (Triage). */
  redFlags?: string[];
  basis?: string | null;
  mode: ResultMode;
  className?: string;
};

/**
 * Verdict block: gauge + level, confidence ring, escalation flag, red flags.
 * Announced politely to screen readers when the result changes.
 */
export function VerdictBlock({ severityLabel = "Severity", severity, secondary, confidence, confidenceNote, escalate, escalationText, redFlags, basis, mode, className }: VerdictBlockProps) {
  const tone = riskClasses(severity);
  const EscalationIcon = escalate ? ShieldAlert : ShieldCheck;
  const announcement = `${severityLabel} ${severity ?? "unknown"}. Confidence ${confidence != null ? `${Math.round(confidence)} percent` : "not reported"}. ${escalate ? "Escalation recommended" : "No escalation flag"}.`;

  return (
    <section
      data-testid="verdict-block"
      aria-live="polite"
      aria-atomic="true"
      aria-label={announcement}
      className={cn("card-surface overflow-hidden border-l-4 p-0", tone.rail, className)}
    >
      <div className="grid gap-px bg-border-hairline md:grid-cols-[1.2fr_1fr_1.2fr]">
        <div className="flex items-center gap-4 bg-surface px-5 py-4">
          <SeverityGauge level={severity} width={110} title={severityLabel} />
          <div className="min-w-0">
            <p className="text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">{severityLabel}</p>
            <p className={cn("mt-1 text-2xl font-semibold tracking-[-0.01em]", tone.text)}>{severity ?? "Unknown"}</p>
            {secondary ? <p className="mt-0.5 truncate text-xs text-ink-500">{secondary}</p> : null}
          </div>
        </div>

        <div className="flex items-center gap-4 bg-surface px-5 py-4">
          <ConfidenceRing value={confidence} size={34} title="Confidence" label={confidence != null ? Math.round(confidence).toString() : "–"} />
          <div className="min-w-0">
            <p className="text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">Confidence</p>
            <p className="mt-1 text-lg font-semibold text-ink-900 rs-tabular">{confidence != null ? `${Math.round(confidence)}%` : "Not reported"}</p>
            {confidenceNote ? <p className="mt-0.5 text-2xs text-ink-500">{confidenceNote}</p> : null}
          </div>
        </div>

        <div className={cn("flex items-center gap-4 px-5 py-4", escalate ? riskClasses("Critical").soft : "bg-surface")}>
          <EscalationIcon className={cn("h-6 w-6 shrink-0", escalate ? "text-severity-critical" : "text-severity-low")} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">Escalation</p>
            <p className={cn("mt-1 text-sm font-semibold", escalate ? "text-severity-critical" : "text-severity-low")}>
              {escalate ? "Escalation recommended" : "No escalation flag"}
            </p>
            {escalationText ? <p className="mt-0.5 text-2xs text-ink-500">{escalationText}</p> : null}
          </div>
        </div>
      </div>

      {redFlags && redFlags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border-hairline bg-surface px-5 py-3">
          <span className="text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">
            Red flags <span className="rs-tabular">{redFlags.length}</span>
          </span>
          {redFlags.map((flag) => (
            <SeverityChip key={flag} level="Critical" label={flag} />
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-hairline bg-surface-sunken px-5 py-2 text-2xs text-ink-500">
        <ModeBadge mode={mode} />
        {basis ? <span>{basis}</span> : null}
      </div>
    </section>
  );
}

export type EvidenceChip = { id: string; label: string; query: string; score?: number | null; section?: string | null };

/** Citation chips that deep-link into the Knowledge Center search. */
export function EvidenceChips({ title = "Evidence lookups", items, className }: { title?: string; items: EvidenceChip[]; className?: string }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">{title}</span>
      {items.map((item, index) => (
        <CitationChip key={item.id} index={index + 1} title={item.label} query={item.query} score={item.score ?? null} section={item.section ?? null} />
      ))}
    </div>
  );
}
