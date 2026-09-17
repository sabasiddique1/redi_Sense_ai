import { cn } from "@/components/ui/cn";

/** Flat loading block at the chart's reserved size (design: no shimmer). */
export function ChartLoading({ height, className, label = "Loading chart" }: { height: number; className?: string; label?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      aria-busy="true"
      className={cn("rs-skeleton w-full", className)}
      style={{ height }}
    />
  );
}

/** Dashed baseline plus a short note; keeps the reserved height. */
export function ChartEmpty({ height, className, message = "Not enough data yet" }: { height: number; className?: string; message?: string }) {
  return (
    <div
      role="img"
      aria-label={message}
      className={cn("flex w-full flex-col justify-end gap-1", className)}
      style={{ height }}
    >
      <div className="h-px w-full border-t border-dashed border-border-strong" />
      <p className="text-2xs text-ink-400">{message}</p>
    </div>
  );
}
