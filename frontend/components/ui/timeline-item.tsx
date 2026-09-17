import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { SeverityGlyph } from "@/components/ui/severity-glyph";
import type { RiskLevel } from "@/features/shared/risk";

export type TimelineItemProps = {
  time: string;
  title: string;
  detail?: string;
  /** Event family, drives the dot colour */
  type: "report" | "triage" | "copilot" | "alert" | "medication" | "other";
  risk?: RiskLevel | null;
  compact?: boolean;
  children?: ReactNode;
  className?: string;
};

const DOT: Record<TimelineItemProps["type"], string> = {
  report: "bg-accent-600",
  triage: "bg-data-2",
  copilot: "bg-ink-500",
  alert: "bg-severity-critical",
  medication: "bg-ink-300",
  other: "bg-ink-300",
};

/** Time gutter · type dot · title · detail; compact variant for activity feeds. */
export function TimelineItem({ time, title, detail, type, risk, compact, children, className }: TimelineItemProps) {
  return (
    <li className={cn("grid gap-3", compact ? "grid-cols-[44px_10px_minmax(0,1fr)] items-baseline" : "grid-cols-[52px_12px_minmax(0,1fr)]", className)}>
      <time className="font-mono text-2xs text-ink-500 rs-tabular">{time}</time>
      <span className="relative flex justify-center pt-[5px]">
        <span className={cn("h-2 w-2 rounded-full", DOT[type])} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className={cn("flex items-center gap-2 text-ink-900", compact ? "text-xs" : "text-sm font-semibold")}>
          {risk ? <SeverityGlyph level={risk} size={8} /> : null}
          <span className="truncate">{title}</span>
        </p>
        {detail ? <p className={cn("text-ink-500", compact ? "text-2xs" : "mt-0.5 text-xs")}>{detail}</p> : null}
        {children}
      </div>
    </li>
  );
}
