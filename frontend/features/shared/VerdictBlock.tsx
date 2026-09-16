import Link from "next/link";
import { ArrowUpRight, BookOpen, ShieldAlert, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import type { ResultMode } from "@/lib/contracts";
import { riskClasses, type RiskLevel } from "./risk";

function modeLabel(mode: ResultMode): string {
  if (mode === "real") return "Connected";
  if (mode === "fallback") return "Connected fallback";
  if (mode === "demo") return "Demo";
  return "Error";
}

export function VerdictBlock({
  severityLabel = "Severity",
  severity,
  secondary,
  confidence,
  confidenceNote,
  escalate,
  escalationText,
  basis,
  mode,
  className,
}: {
  severityLabel?: string;
  severity: RiskLevel | null;
  /** Shown under the severity badge, e.g. the care level or the predicted category. */
  secondary?: string | null;
  /** Percent, or null when the pipeline does not report one. */
  confidence: number | null;
  confidenceNote?: string;
  escalate: boolean;
  escalationText?: string;
  basis?: string | null;
  mode: ResultMode;
  className?: string;
}) {
  const tone = riskClasses(severity);
  const EscalationIcon = escalate ? ShieldAlert : ShieldCheck;

  return (
    <Card
      data-testid="verdict-block"
      className={cn("overflow-hidden border-l-4 p-0", tone.rail, className)}
    >
      <div className="grid gap-px bg-border-subtle sm:grid-cols-3">
        <div className="bg-white px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
            {severityLabel}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", tone.dot)} />
            <span className={cn("text-lg font-semibold tracking-tight", tone.text)}>
              {severity ?? "Unknown"}
            </span>
          </div>
          {secondary ? (
            <p className="mt-1 text-[11px] text-text-secondary">{secondary}</p>
          ) : null}
        </div>

        <div className="bg-white px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
            Confidence
          </p>
          <p className="mt-2 text-lg font-semibold tracking-tight text-text-primary">
            {confidence != null ? `${confidence}%` : "Not reported"}
          </p>
          {confidenceNote ? (
            <p className="mt-1 text-[11px] text-text-secondary">{confidenceNote}</p>
          ) : null}
        </div>

        <div className={cn("px-5 py-4", escalate ? riskClasses("Critical").soft : "bg-white")}>
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
            Escalation
          </p>
          <div className="mt-2 flex items-center gap-2">
            <EscalationIcon
              className={cn("h-5 w-5", escalate ? "text-risk-critical-text" : "text-risk-low-text")}
            />
            <span
              className={cn(
                "text-sm font-semibold",
                escalate ? "text-risk-critical-text" : "text-risk-low-text",
              )}
            >
              {escalate ? "Escalation recommended" : "No escalation flag"}
            </span>
          </div>
          {escalationText ? (
            <p className="mt-1 text-[11px] text-text-secondary">{escalationText}</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-subtle bg-surface-muted px-5 py-2 text-[11px] text-text-secondary">
        <span className="font-medium text-text-body">{modeLabel(mode)}</span>
        {basis ? <span>{basis}</span> : null}
      </div>
    </Card>
  );
}

export type EvidenceChip = { id: string; label: string; query: string };

/** Chips that deep-link into the Knowledge Center search. */
export function EvidenceChips({
  title = "Evidence lookups",
  items,
  className,
}: {
  title?: string;
  items: EvidenceChip[];
  className?: string;
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-secondary">
        <BookOpen className="h-3.5 w-3.5 text-primary" />
        {title}
      </span>
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/knowledge-center?query=${encodeURIComponent(item.query)}`}
          className="inline-flex items-center gap-1 rounded-full border border-primary-border bg-primary-soft px-2.5 py-1 text-[11px] font-medium text-primary-strong transition-colors hover:bg-primary hover:text-white"
          title={`Search the Knowledge Center for "${item.query}"`}
        >
          {item.label}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      ))}
    </div>
  );
}
