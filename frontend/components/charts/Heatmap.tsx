import { cn } from "@/components/ui/cn";
import { quantize } from "./math";
import { ChartEmpty, ChartLoading } from "./ChartStates";

export type HeatmapProps = {
  /** One value per cell, oldest first */
  values: number[];
  /** Labels for the accessible description, same length as values */
  labels?: string[];
  columns?: number;
  steps?: number;
  title: string;
  caption?: string;
  className?: string;
};

const OPACITY = [0.15, 0.3, 0.5, 0.7, 0.9];

/** Calendar-style intensity grid; one hue at stepped opacity (design rule). */
export function Heatmap({ values, labels, columns = 10, steps = 5, title, caption, className }: HeatmapProps) {
  const max = Math.max(0, ...values);
  const rows = Math.ceil(values.length / columns);
  const reservedHeight = rows * 22;
  if (values.length === 0 || max === 0) {
    return <ChartEmpty height={reservedHeight || 44} className={className} message="No activity recorded" />;
  }

  return (
    <div className={className}>
      <div
        role="img"
        aria-label={`${title}: ${values.reduce((s, v) => s + v, 0)} events over ${values.length} days, busiest ${max}`}
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {values.map((value, index) => (
          <div
            key={index}
            title={labels ? `${labels[index]}: ${value}` : String(value)}
            className="aspect-square rounded-[2px] bg-severity-low"
            style={{ opacity: value === 0 ? 0.08 : OPACITY[quantize(value, max, steps)] }}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-2xs text-ink-400" aria-hidden="true">
        <span>{caption}</span>
        <span className="inline-flex items-center gap-1">
          less
          {OPACITY.map((o) => (
            <span key={o} className={cn("inline-block h-2.5 w-2.5 rounded-[2px] bg-severity-low")} style={{ opacity: o }} />
          ))}
          more
        </span>
      </div>
    </div>
  );
}

export function HeatmapLoading({ rows = 3, className }: { rows?: number; className?: string }) {
  return <ChartLoading height={rows * 22 + 20} className={className} />;
}
