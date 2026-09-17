"use client";

import { areaPath, polylinePoints, scalePoints } from "./math";
import { useMeasuredWidth } from "./useMeasuredWidth";
import { ChartEmpty, ChartLoading } from "./ChartStates";

export type HourlyPoint = { label: string; value: number };

export type HourlyAreaChartProps = {
  points: HourlyPoint[];
  /** Horizontal dashed rule; omitted when null */
  target?: number | null;
  targetLabel?: string;
  height?: number;
  color?: string;
  title: string;
  className?: string;
};

export function HourlyAreaChart({ points, target = null, targetLabel, height = 90, color = "var(--rs-data-2)", title, className }: HourlyAreaChartProps) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>(300);
  if (points.length < 2) {
    return <ChartEmpty height={height + 20} className={className} />;
  }
  const values = points.map((p) => p.value);
  const max = Math.max(...values, target ?? 0);
  const scaled = scalePoints(values, width, height, { min: 0, max: max || 1, pad: 4 });
  const targetY = target != null ? scalePoints([target], width, height, { min: 0, max: max || 1, pad: 4 })[0].y : null;
  const first = points[0].label;
  const last = points[points.length - 1].label;

  return (
    <div ref={ref} className={className}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${title}, ${first} to ${last}${target != null ? `, target ${target}` : ""}`}>
        <title>{title}</title>
        {targetY != null ? (
          <line x1={0} x2={width} y1={targetY} y2={targetY} stroke="var(--rs-ink-300)" strokeDasharray="4 4" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ) : null}
        <path d={areaPath(scaled, height)} fill={color} fillOpacity={0.12} />
        <polyline points={polylinePoints(scaled)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex items-center justify-between text-2xs text-ink-400" aria-hidden="true">
        <span>{first}</span>
        {target != null ? <span>{targetLabel ?? `target: ${target}`}</span> : null}
        <span>now {last}</span>
      </div>
    </div>
  );
}

export function HourlyAreaChartLoading({ height = 90, className }: { height?: number; className?: string }) {
  return <ChartLoading height={height + 20} className={className} />;
}

export function HourlyAreaChartEmpty({ height = 90, className, message }: { height?: number; className?: string; message?: string }) {
  return <ChartEmpty height={height + 20} className={className} message={message} />;
}
