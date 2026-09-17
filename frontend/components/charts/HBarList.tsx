import { cn } from "@/components/ui/cn";
import { riskClasses, type RiskLevel } from "@/features/shared/risk";
import { ChartEmpty, ChartLoading } from "./ChartStates";

export type HBarItem = { label: string; weight: number };

export type HBarListProps = {
  items: HBarItem[];
  /** Colour of the top contributor; the rest stay neutral */
  emphasis?: RiskLevel;
  title: string;
  className?: string;
};

/** Label · track · mono percentage rows; only the driver is coloured. */
export function HBarList({ items, emphasis = "High", title, className }: HBarListProps) {
  if (items.length === 0) {
    return <ChartEmpty height={items.length * 24 || 48} className={className} />;
  }
  const max = Math.max(1, ...items.map((i) => i.weight));
  const top = items.reduce((m, i) => (i.weight > m.weight ? i : m), items[0]);

  return (
    <ul className={cn("space-y-2", className)} aria-label={title}>
      {items.map((item) => (
        <li key={item.label} className="grid grid-cols-[130px_minmax(0,1fr)_34px] items-center gap-3 text-xs">
          <span className="truncate text-ink-700">{item.label}</span>
          <span className="h-[7px] overflow-hidden rounded-pill bg-surface-sunken" role="img" aria-label={`${item.label} ${Math.round(item.weight)}%`}>
            <span
              className={cn("block h-full rounded-pill transition-[width] duration-[var(--rs-motion-slow)]", item === top ? riskClasses(emphasis).bar : "bg-ink-300")}
              style={{ width: `${Math.round((item.weight / max) * 100)}%` }}
            />
          </span>
          <span className="text-right font-mono text-2xs text-ink-500 rs-tabular" aria-hidden="true">{Math.round(item.weight)}%</span>
        </li>
      ))}
    </ul>
  );
}

export function HBarListLoading({ rows = 4, className }: { rows?: number; className?: string }) {
  return <ChartLoading height={rows * 24} className={className} />;
}
