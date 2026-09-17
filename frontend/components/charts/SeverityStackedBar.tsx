import { SeverityGlyph } from "@/components/ui/severity-glyph";
import { cn } from "@/components/ui/cn";
import { RISK_LEVELS, riskClasses, type RiskLevel } from "@/features/shared/risk";
import { stackedWidths } from "./math";
import { ChartEmpty, ChartLoading } from "./ChartStates";

export type SeverityBucket = { level: RiskLevel; value: number };

export type SeverityStackedBarProps = {
  buckets: SeverityBucket[];
  height?: 12 | 16;
  legend?: "inline" | "list" | "none";
  title: string;
  className?: string;
};

/** Full-width stacked bar of the four severity buckets, glyph-coded legend. */
export function SeverityStackedBar({ buckets, height = 16, legend = "inline", title, className }: SeverityStackedBarProps) {
  const ordered = RISK_LEVELS.map((level) => buckets.find((b) => b.level === level) ?? { level, value: 0 });
  const widths = stackedWidths(ordered.map((b) => b.value));
  const total = ordered.reduce((s, b) => s + b.value, 0);
  if (total <= 0) {
    return <ChartEmpty height={height + (legend === "none" ? 0 : 24)} className={className} />;
  }
  const summary = ordered.map((b) => `${b.level} ${b.value}`).join(", ");

  return (
    <div className={className}>
      <div
        role="img"
        aria-label={`${title}: ${summary}`}
        className="flex w-full overflow-hidden rounded-pill bg-surface-sunken"
        style={{ height }}
      >
        {ordered.map((bucket, index) => (
          <div
            key={bucket.level}
            className={cn(riskClasses(bucket.level).bar, "transition-[width] duration-[var(--rs-motion-slow)]")}
            style={{ width: `${widths[index]}%` }}
          />
        ))}
      </div>
      {legend === "inline" ? (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-ink-500" aria-hidden="true">
          {ordered.map((bucket) => (
            <li key={bucket.level} className="inline-flex items-center gap-1.5">
              <SeverityGlyph level={bucket.level} size={8} />
              {bucket.level} <span className="font-medium text-ink-700 rs-tabular">{bucket.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {legend === "list" ? (
        <ul className="mt-3 space-y-1.5 text-xs text-ink-700" aria-hidden="true">
          {ordered.map((bucket, index) => (
            <li key={bucket.level} className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2">
                <SeverityGlyph level={bucket.level} size={9} />
                {bucket.level}
              </span>
              <span className="rs-tabular text-ink-500">
                <span className="font-medium text-ink-900">{bucket.value}</span> · {widths[index]}%
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SeverityStackedBarLoading({ height = 16, className }: { height?: number; className?: string }) {
  return <ChartLoading height={height + 24} className={className} />;
}
