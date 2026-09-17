"use client";

import { RISK_LEVELS, riskIndex, type RiskLevel } from "@/features/shared/risk";
import { stepPath } from "./math";
import { useMeasuredWidth } from "./useMeasuredWidth";
import { ChartEmpty, ChartLoading } from "./ChartStates";

export type StepLinePoint = { label: string; level: RiskLevel | null };

export type StepLineProps = {
  points: StepLinePoint[];
  height?: number;
  gridlines?: boolean;
  title: string;
  className?: string;
};

/** Categorical-y step line for severity over time. */
export function StepLine({ points, height = 70, gridlines = true, title, className }: StepLineProps) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>(200);
  const valid = points.filter((p) => p.level);
  if (valid.length < 2) {
    return <ChartEmpty height={height + 16} className={className} />;
  }
  const pad = 10;
  const rows = RISK_LEVELS.length - 1;
  const yFor = (level: RiskLevel | null) => height - pad - (riskIndex(level) / rows) * (height - pad * 2);
  const step = width / (points.length - 1);
  const scaled = points.map((p, i) => ({ x: i * step, y: yFor(p.level) }));
  const top = points.reduce((m, p) => (riskIndex(p.level) > riskIndex(m) ? p.level : m), points[0].level);
  const stroke = top ? `var(--rs-severity-${top.toLowerCase()})` : "var(--rs-ink-500)";

  return (
    <div ref={ref} className={className}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${title}: ${points.map((p) => `${p.label} ${p.level ?? "none"}`).join(", ")}`}>
        <title>{title}</title>
        {gridlines
          ? RISK_LEVELS.map((level) => (
              <line key={level} x1={0} x2={width} y1={yFor(level)} y2={yFor(level)} stroke="var(--rs-border-hairline)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))
          : null}
        <path d={stepPath(scaled)} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-2xs text-ink-400" aria-hidden="true">
        <span>Low</span>
        <span>Mod</span>
        <span>High</span>
        <span>Crit</span>
      </div>
    </div>
  );
}

export function StepLineLoading({ height = 70, className }: { height?: number; className?: string }) {
  return <ChartLoading height={height + 16} className={className} />;
}

export function StepLineEmpty({ height = 70, className, message }: { height?: number; className?: string; message?: string }) {
  return <ChartEmpty height={height + 16} className={className} message={message} />;
}
