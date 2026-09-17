import { cn } from "@/components/ui/cn";
import type { ResultMode } from "@/lib/contracts";

const LABEL: Record<ResultMode, string> = { real: "Connected", fallback: "Connected", demo: "Demo", error: "Error" };
const HINT: Record<ResultMode, string> = {
  real: "Connected to the backend",
  fallback: "Connected; the backend answered with a heuristic fallback",
  demo: "Demo mode: curated sample data, no backend calls",
  error: "The backend request failed",
};

/** CONNECTED / DEMO pill; fallback keeps the connected tone with a tooltip, error gets a critical dot. */
export function ModeBadge({ mode, className }: { mode: ResultMode; className?: string }) {
  const dot = mode === "real" || mode === "fallback" ? "bg-accent-500" : mode === "demo" ? "bg-ink-300" : "bg-severity-critical";
  return (
    <span
      title={HINT[mode]}
      className={cn("inline-flex items-center gap-1.5 rounded-pill border border-border-strong px-2 py-0.5 text-2xs font-semibold uppercase tracking-[0.05em] text-ink-700", className)}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} aria-hidden="true" />
      {LABEL[mode]}
      <span className="sr-only">. {HINT[mode]}</span>
    </span>
  );
}
