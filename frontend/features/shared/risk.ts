/**
 * Clinical severity scale shared by every chip, chart, verdict and table cell.
 * Colours come from the --rs-severity-* tokens in app/globals.css; each level
 * also carries a glyph shape so colour is never the only encoding (design rule).
 */
export type RiskLevel = "Low" | "Moderate" | "High" | "Critical";
export type SeverityGlyph = "circle" | "triangle" | "diamond" | "octagon";

export const RISK_LEVELS: RiskLevel[] = ["Low", "Moderate", "High", "Critical"];

export function normalizeRiskLevel(value: string | null | undefined): RiskLevel | null {
  if (!value) return null;
  const candidate = value.trim().toLowerCase();
  if (candidate === "low") return "Low";
  if (candidate === "moderate" || candidate === "medium") return "Moderate";
  if (candidate === "high" || candidate === "urgent") return "High";
  if (candidate === "critical" || candidate === "emergency") return "Critical";
  return null;
}

/** 0-based position on the scale, for charts with a categorical y axis. */
export function riskIndex(level: RiskLevel | null | undefined): number {
  return level ? RISK_LEVELS.indexOf(level) : 0;
}

export type RiskClasses = {
  /** Tinted chip: severity ink on its -bg tint */
  badge: string;
  /** Solid fill (bars, dots, rails) */
  bar: string;
  dot: string;
  /** Severity colour as text */
  text: string;
  /** Tint background only */
  soft: string;
  border: string;
  /** Left rail for verdict blocks */
  rail: string;
  glyph: SeverityGlyph;
  /** CSS custom property holding the severity colour, for SVG fills/strokes */
  cssVar: string;
  cssBgVar: string;
};

const CLASSES: Record<RiskLevel, RiskClasses> = {
  Low: {
    badge: "bg-severity-low-bg text-severity-low",
    bar: "bg-severity-low",
    dot: "bg-severity-low",
    text: "text-severity-low",
    soft: "bg-severity-low-bg",
    border: "border-severity-low/30",
    rail: "border-l-severity-low",
    glyph: "circle",
    cssVar: "var(--rs-severity-low)",
    cssBgVar: "var(--rs-severity-low-bg)",
  },
  Moderate: {
    badge: "bg-severity-moderate-bg text-severity-moderate",
    bar: "bg-severity-moderate",
    dot: "bg-severity-moderate",
    text: "text-severity-moderate",
    soft: "bg-severity-moderate-bg",
    border: "border-severity-moderate/30",
    rail: "border-l-severity-moderate",
    glyph: "triangle",
    cssVar: "var(--rs-severity-moderate)",
    cssBgVar: "var(--rs-severity-moderate-bg)",
  },
  High: {
    badge: "bg-severity-high-bg text-severity-high",
    bar: "bg-severity-high",
    dot: "bg-severity-high",
    text: "text-severity-high",
    soft: "bg-severity-high-bg",
    border: "border-severity-high/30",
    rail: "border-l-severity-high",
    glyph: "diamond",
    cssVar: "var(--rs-severity-high)",
    cssBgVar: "var(--rs-severity-high-bg)",
  },
  Critical: {
    badge: "bg-severity-critical-bg text-severity-critical",
    bar: "bg-severity-critical",
    dot: "bg-severity-critical",
    text: "text-severity-critical",
    soft: "bg-severity-critical-bg",
    border: "border-severity-critical/30",
    rail: "border-l-severity-critical",
    glyph: "octagon",
    cssVar: "var(--rs-severity-critical)",
    cssBgVar: "var(--rs-severity-critical-bg)",
  },
};

export function riskClasses(level: RiskLevel | null | undefined): RiskClasses {
  return CLASSES[level ?? "Low"];
}

/** Solid badge for the most urgent levels: contrasting ink on the severity fill. */
export function riskSolidBadgeClasses(level: RiskLevel): string {
  return `${CLASSES[level].bar} text-ink-on-accent`;
}

export function isEscalationLevel(level: RiskLevel | null | undefined): boolean {
  return level === "High" || level === "Critical";
}
