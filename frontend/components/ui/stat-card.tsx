import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Sparkline, SparklineEmpty } from "@/components/charts/Sparkline";
import { cn } from "@/components/ui/cn";
import { riskClasses, type RiskLevel } from "@/features/shared/risk";

export type StatDelta = { direction: "up" | "down" | "flat"; label: string; /** Colour the delta on the severity scale (up is not always good) */ tone?: RiskLevel | "accent" };

export type StatCardProps = {
  label: string;
  value: string;
  unit?: string;
  /** Secondary inline count, e.g. the critical subset */
  secondary?: { value: string; label: string; tone?: RiskLevel };
  delta?: StatDelta;
  series?: number[];
  seriesLabel?: string;
  footnote?: string;
  className?: string;
};

/** Uppercase label · 3xl value · delta chip · sparkline · footnote. */
export function StatCard({ label, value, unit, secondary, delta, series, seriesLabel, footnote, className }: StatCardProps) {
  const DeltaIcon = delta?.direction === "down" ? ArrowDownRight : ArrowUpRight;
  const deltaTone = delta?.tone === "accent" || !delta?.tone ? "text-accent-700" : riskClasses(delta.tone).text;
  return (
    <div className={cn("card-surface flex flex-col gap-3 p-5", className)}>
      <p className="text-2xs font-semibold uppercase tracking-[0.04em] text-ink-500">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-[-0.015em] text-ink-900 rs-tabular">{value}</span>
        {unit ? <span className="text-sm text-ink-500">{unit}</span> : null}
        {secondary ? (
          <span className={cn("ml-1 text-sm font-semibold rs-tabular", secondary.tone ? riskClasses(secondary.tone).text : "text-ink-700")}>
            {secondary.value} <span className="text-2xs font-normal text-ink-500">{secondary.label}</span>
          </span>
        ) : null}
        {delta && delta.direction !== "flat" ? (
          <span className={cn("ml-auto inline-flex items-center gap-0.5 text-xs font-semibold rs-tabular", deltaTone)}>
            <DeltaIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {delta.label}
          </span>
        ) : delta ? (
          <span className="ml-auto text-xs text-ink-500">{delta.label}</span>
        ) : null}
      </div>
      <div className="h-7">
        {series && series.length >= 2 ? (
          <Sparkline values={series} height={28} title={seriesLabel ?? `${label} trend`} />
        ) : (
          <SparklineEmpty height={28} message={series ? "Not enough data yet" : "Not available"} />
        )}
      </div>
      {footnote ? <p className="text-2xs text-ink-400">{footnote}</p> : null}
    </div>
  );
}
