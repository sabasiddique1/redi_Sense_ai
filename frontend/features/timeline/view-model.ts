import type { TimelineEventResponse } from "../../lib/contracts";
import type { TimelineItemProps } from "../../components/ui/timeline-item";
import type { StepLinePoint } from "../../components/charts/StepLine";
import { normalizeRiskLevel, riskIndex, type RiskLevel } from "../shared/risk.ts";

export type TimelineFilter = "all" | "report" | "triage" | "copilot" | "alert";

export type TimelineViewEvent = {
  id: string;
  type: TimelineItemProps["type"];
  filter: Exclude<TimelineFilter, "all">;
  title: string;
  detail: string;
  date: Date;
  time: string;
  risk: RiskLevel | null;
  findings: string[];
};

export type TimelineGroup = { key: string; label: string; events: TimelineViewEvent[] };

export function classifyEventType(eventType: string): TimelineItemProps["type"] {
  if (eventType.includes("report")) return "report";
  if (eventType.includes("triage") || eventType.includes("symptom")) return "triage";
  if (eventType.includes("copilot")) return "copilot";
  if (eventType.includes("alert") || eventType.includes("critical") || eventType.includes("escalat")) return "alert";
  if (eventType.includes("medication")) return "medication";
  return "other";
}

function filterOf(type: TimelineItemProps["type"]): Exclude<TimelineFilter, "all"> {
  if (type === "report") return "report";
  if (type === "triage") return "triage";
  if (type === "copilot") return "copilot";
  return "alert";
}

/** Risk of an event: explicit metadata first, then "Triage: High risk" style titles. */
export function eventRisk(event: TimelineEventResponse): RiskLevel | null {
  const metadata = event.metadata ?? {};
  const fromMeta = normalizeRiskLevel(typeof metadata.risk_level === "string" ? metadata.risk_level : null);
  if (fromMeta) return fromMeta;
  const match = event.title.match(/\b(Low|Moderate|High|Critical)\b/i);
  return match ? normalizeRiskLevel(match[1]) : null;
}

export function mapTimelineEvent(event: TimelineEventResponse): TimelineViewEvent {
  const metadata = event.metadata ?? {};
  const findingsSource = Array.isArray(metadata.findings)
    ? metadata.findings
    : Array.isArray(metadata.key_findings)
      ? metadata.key_findings
      : Array.isArray(metadata.red_flags)
        ? metadata.red_flags
        : [];
  const type = classifyEventType(event.event_type);
  const date = new Date(event.timestamp);
  return {
    id: String(event.id),
    type,
    filter: filterOf(type),
    title: event.title,
    detail: event.summary,
    date,
    time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
    risk: eventRisk(event),
    findings: findingsSource.filter((item): item is string => typeof item === "string"),
  };
}

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function groupByDay(events: TimelineViewEvent[], now: Date = new Date()): TimelineGroup[] {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const groups = new Map<string, TimelineGroup>();
  for (const event of events) {
    const key = dayKey(event.date);
    const dateLabel = event.date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    const label = key === today ? `Today — ${dateLabel}` : key === yesterday ? `Yesterday — ${dateLabel}` : dateLabel;
    const group = groups.get(key) ?? { key, label, events: [] };
    group.events.push(event);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Daily event counts for the last `days` days, oldest first. */
export function dailyCounts(events: TimelineViewEvent[], days = 30, now: Date = new Date()): { labels: string[]; values: number[] } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const values = new Array<number>(days).fill(0);
  const labels: string[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    labels.push(d.toLocaleDateString([], { month: "short", day: "numeric" }));
  }
  for (const event of events) {
    const offset = Math.floor((new Date(event.date.getFullYear(), event.date.getMonth(), event.date.getDate()).getTime() - start.getTime()) / 86_400_000);
    if (offset >= 0 && offset < days) values[offset] += 1;
  }
  return { labels, values };
}

/** Highest risk per day over the last `days` days (categorical step line input). */
export function severityByDay(events: TimelineViewEvent[], days = 7, now: Date = new Date()): StepLinePoint[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const points: StepLinePoint[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dayKey(d);
    let top: RiskLevel | null = null;
    for (const event of events) {
      if (dayKey(event.date) !== key || !event.risk) continue;
      if (!top || riskIndex(event.risk) > riskIndex(top)) top = event.risk;
    }
    points.push({ label: d.toLocaleDateString([], { weekday: "short" }), level: top });
  }
  return points;
}

export function heatmapCaption(values: number[], labels: string[]): string {
  const total = values.reduce((s, v) => s + v, 0);
  if (total === 0) return "No events in the last 30 days.";
  const max = Math.max(...values);
  const busiest = labels[values.indexOf(max)];
  return `${total} events in 30 days; busiest ${busiest} (${max}).`;
}

export function severityCaption(points: StepLinePoint[]): string {
  const withRisk = points.filter((p) => p.level);
  if (withRisk.length === 0) return "No risk-rated events in the last 7 days.";
  const spikes = points.filter((p) => p.level === "Critical" || p.level === "High");
  if (spikes.length === 0) return "No High or Critical events in the last 7 days.";
  return `${spikes.length} day${spikes.length === 1 ? "" : "s"} with High or Critical events: ${spikes.map((p) => p.label).join(", ")}.`;
}
