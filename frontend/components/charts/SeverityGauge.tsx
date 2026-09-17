import { RISK_LEVELS, riskClasses, riskIndex, type RiskLevel } from "@/features/shared/risk";
import { arcPath, gaugeAngle } from "./math";
import { ChartLoading } from "./ChartStates";

export type SeverityGaugeProps = {
  level: RiskLevel | null;
  width?: number;
  title?: string;
  className?: string;
};

/** Four-band semicircle with a needle; the verdict-block anchor on Triage and Analyzer. */
export function SeverityGauge({ level, width = 130, title = "Severity gauge", className }: SeverityGaugeProps) {
  const height = Math.round(width * 0.55);
  const cx = width / 2;
  const cy = height - 8;
  const r = width / 2 - 12;
  const bandWidth = 180 / RISK_LEVELS.length;
  const angle = level ? gaugeAngle(riskIndex(level), RISK_LEVELS.length) : null;
  const needle = angle != null
    ? { x: cx + (r - 6) * Math.cos(((angle - 180) * Math.PI) / 180), y: cy + (r - 6) * Math.sin(((angle - 180) * Math.PI) / 180) }
    : null;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}: ${level ?? "unknown"}`} className={className}>
      <title>{`${title}: ${level ?? "unknown"}`}</title>
      {RISK_LEVELS.map((band, index) => (
        <path
          key={band}
          d={arcPath(cx, cy, r, -90 + index * bandWidth + 1, -90 + (index + 1) * bandWidth - 1)}
          fill="none"
          stroke={riskClasses(band).cssVar}
          strokeOpacity={level && level !== band ? 0.35 : 1}
          strokeWidth={13}
          strokeLinecap="butt"
        />
      ))}
      {needle ? (
        <>
          <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="var(--rs-ink-900)" strokeWidth={2} strokeLinecap="round" className="transition-[x2,y2] duration-[var(--rs-motion-slow)]" />
          <circle cx={cx} cy={cy} r={4} fill="var(--rs-ink-900)" />
        </>
      ) : null}
      <text x={4} y={height - 1} fontSize={10} fill="var(--rs-ink-400)">Low</text>
      <text x={width - 4} y={height - 1} fontSize={10} fill="var(--rs-ink-400)" textAnchor="end">Crit</text>
    </svg>
  );
}

export function SeverityGaugeLoading({ width = 130, className }: { width?: number; className?: string }) {
  return <ChartLoading height={Math.round(width * 0.55)} className={className} />;
}
