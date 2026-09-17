"use client";

import type { RiskLevel } from "@/features/shared/risk";
import { riskClasses } from "@/features/shared/risk";
import { polylinePoints, scalePoints } from "./math";
import { useMeasuredWidth } from "./useMeasuredWidth";
import { ChartEmpty, ChartLoading } from "./ChartStates";

export type SparklineProps = {
  values: number[];
  /** Second series drawn in ink-300 (e.g. diastolic under systolic) */
  secondary?: number[];
  /** Per-point severity markers (risk-trend variant); line stays neutral */
  markers?: (RiskLevel | null)[];
  height?: number;
  /** CSS colour, defaults to the accent; severity variants pass riskClasses().cssVar */
  stroke?: string;
  title: string;
  className?: string;
};

export function Sparkline({ values, secondary, markers, height = 28, stroke = "var(--rs-accent-600)", title, className }: SparklineProps) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>(100);
  if (values.length < 2) {
    return <ChartEmpty height={height} className={className} />;
  }
  const all = secondary ? [...values, ...secondary] : values;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const primary = scalePoints(values, width, height, { min, max, pad: 3 });
  const second = secondary ? scalePoints(secondary, width, height, { min, max, pad: 3 }) : null;
  const lineStroke = markers ? "var(--rs-ink-300)" : stroke;

  return (
    <div ref={ref} className={className} style={{ height }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={title}>
        <title>{title}</title>
        {second ? (
          <polyline points={polylinePoints(second)} fill="none" stroke="var(--rs-ink-300)" strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ) : null}
        <polyline points={polylinePoints(primary)} fill="none" stroke={lineStroke} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {markers
          ? primary.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={markers[i] ? riskClasses(markers[i]).cssVar : "var(--rs-ink-300)"} />
            ))
          : null}
      </svg>
    </div>
  );
}

export function SparklineLoading({ height = 28, className }: { height?: number; className?: string }) {
  return <ChartLoading height={height} className={className} />;
}

export function SparklineEmpty({ height = 28, className, message }: { height?: number; className?: string; message?: string }) {
  return <ChartEmpty height={height} className={className} message={message} />;
}
