import { cn } from "@/components/ui/cn";
import { ringDash } from "./math";

export type ConfidenceRingProps = {
  /** 0–100; null renders the "not reported" track only */
  value: number | null;
  size?: 16 | 24 | 28 | 30 | 34;
  /** CSS colour for the arc; defaults to the accent */
  color?: string;
  state?: "default" | "loading" | "error";
  /** Centre text; defaults to the rounded value */
  label?: string | null;
  title: string;
  className?: string;
};

const STROKE: Record<number, number> = { 16: 2.5, 24: 3, 28: 3, 30: 3, 34: 3.5 };
const FONT: Record<number, string> = { 16: "text-[8px]", 24: "text-[9px]", 28: "text-2xs", 30: "text-2xs", 34: "text-2xs" };

/** Radial ring with a sibling centre label (text is HTML so it stays crisp). */
export function ConfidenceRing({ value, size = 24, color = "var(--rs-accent-600)", state = "default", label, title, className }: ConfidenceRingProps) {
  const stroke = STROKE[size];
  const r = (size - stroke) / 2;
  const c = size / 2;
  const { dasharray } = ringDash(state === "default" ? value : null, r);
  const centre = label === undefined ? (value == null ? "–" : String(Math.round(value))) : label;
  const accessible =
    state === "loading" ? `${title}: loading` : state === "error" ? `${title}: could not load` : value == null ? `${title}: not reported` : `${title}: ${Math.round(value)}`;

  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={accessible} style={{ transform: "rotate(-90deg)" }}>
        <title>{accessible}</title>
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={state === "error" ? "var(--rs-severity-high)" : "var(--rs-ink-300)"}
          strokeWidth={stroke}
          strokeDasharray={state === "loading" ? "3 4" : undefined}
        />
        {state === "default" && value != null ? (
          <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={dasharray} className="transition-[stroke-dasharray] duration-[var(--rs-motion-slow)]" />
        ) : null}
        {state === "error" ? (
          <line x1={c - r / 2} y1={c - r / 2} x2={c + r / 2} y2={c + r / 2} stroke="var(--rs-severity-high)" strokeWidth={stroke} strokeLinecap="round" />
        ) : null}
      </svg>
      {centre && state === "default" ? (
        <span aria-hidden="true" className={cn("absolute inset-0 flex items-center justify-center font-mono font-medium leading-none text-ink-700 rs-tabular", FONT[size])}>
          {centre}
        </span>
      ) : null}
    </span>
  );
}
