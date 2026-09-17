import { donutSegments } from "./math";
import { ChartEmpty, ChartLoading } from "./ChartStates";

export type DonutSegmentInput = {
  label: string;
  value: number;
  /** CSS colour; the design encodes categories as one hue at stepped opacity */
  color: string;
  opacity?: number;
};

export type DonutChartProps = {
  segments: DonutSegmentInput[];
  centerValue: string;
  centerLabel?: string;
  size?: number;
  strokeWidth?: number;
  title: string;
  legend?: boolean;
  className?: string;
};

export function DonutChart({ segments, centerValue, centerLabel, size = 120, strokeWidth = 14, title, legend = true, className }: DonutChartProps) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total <= 0) {
    return <ChartEmpty height={size} className={className} />;
  }
  const r = (size - strokeWidth) / 2;
  const c = size / 2;
  const computed = donutSegments(segments, r);

  return (
    <div className={className}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${title}: ${computed.map((s) => `${s.label} ${s.percent}%`).join(", ")}`}>
        <title>{title}</title>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--rs-surface-sunken)" strokeWidth={strokeWidth} />
        <g transform={`rotate(-90 ${c} ${c})`}>
          {computed.map((segment) => (
            <circle
              key={segment.label}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={segment.color}
              strokeOpacity={segment.opacity ?? 1}
              strokeWidth={strokeWidth}
              strokeDasharray={segment.dasharray}
              strokeDashoffset={segment.dashoffset}
            />
          ))}
        </g>
        <text x={c} y={centerLabel ? c - 2 : c} textAnchor="middle" dominantBaseline="middle" fill="var(--rs-ink-900)" fontSize={size * 0.2} fontWeight={600}>
          {centerValue}
        </text>
        {centerLabel ? (
          <text x={c} y={c + size * 0.14} textAnchor="middle" dominantBaseline="middle" fill="var(--rs-ink-500)" fontSize={size * 0.09}>
            {centerLabel}
          </text>
        ) : null}
      </svg>
      {legend ? (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-2xs text-ink-500" aria-hidden="true">
          {computed.map((segment) => (
            <li key={segment.label} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: segment.color, opacity: segment.opacity ?? 1 }} />
              {segment.label} <span className="font-medium text-ink-700">{segment.percent}%</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function DonutChartLoading({ size = 120, className }: { size?: number; className?: string }) {
  return <ChartLoading height={size} className={className} />;
}

export function DonutChartEmpty({ size = 120, className, message }: { size?: number; className?: string; message?: string }) {
  return <ChartEmpty height={size} className={className} message={message} />;
}
