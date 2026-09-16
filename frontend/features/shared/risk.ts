/**
 * Clinical risk scale shared by dashboard cards, triage and report verdicts.
 * Colours come from the --rs-risk-* tokens in app/globals.css.
 */
export type RiskLevel = "Low" | "Moderate" | "High" | "Critical";

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

type RiskClasses = { badge: string; bar: string; dot: string; text: string; soft: string; border: string; rail: string };

const CLASSES: Record<RiskLevel, RiskClasses> = {
  Low: {
    badge: "bg-risk-low-soft text-risk-low-text",
    bar: "bg-risk-low",
    dot: "bg-risk-low",
    text: "text-risk-low-text",
    soft: "bg-risk-low-soft",
    border: "border-risk-low/30",
    rail: "border-l-risk-low",
  },
  Moderate: {
    badge: "bg-risk-moderate-soft text-risk-moderate-text",
    bar: "bg-risk-moderate",
    dot: "bg-risk-moderate",
    text: "text-risk-moderate-text",
    soft: "bg-risk-moderate-soft",
    border: "border-risk-moderate/30",
    rail: "border-l-risk-moderate",
  },
  High: {
    badge: "bg-risk-high-soft text-risk-high-text",
    bar: "bg-risk-high",
    dot: "bg-risk-high",
    text: "text-risk-high-text",
    soft: "bg-risk-high-soft",
    border: "border-risk-high/30",
    rail: "border-l-risk-high",
  },
  Critical: {
    badge: "bg-risk-critical-soft text-risk-critical-text",
    bar: "bg-risk-critical",
    dot: "bg-risk-critical",
    text: "text-risk-critical-text",
    soft: "bg-risk-critical-soft",
    border: "border-risk-critical/30",
    rail: "border-l-risk-critical",
  },
};

export function riskClasses(level: RiskLevel | null | undefined): RiskClasses {
  return CLASSES[level ?? "Low"];
}

/** Solid badge for the most urgent levels (white text on the risk fill). */
export function riskSolidBadgeClasses(level: RiskLevel): string {
  return `${CLASSES[level].bar} text-white`;
}

export function isEscalationLevel(level: RiskLevel | null | undefined): boolean {
  return level === "High" || level === "Critical";
}
