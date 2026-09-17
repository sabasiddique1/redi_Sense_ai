import type { DashboardSummaryResponse } from "../../lib/contracts";
import type { StatCardProps } from "../../components/ui/stat-card";
import type { SeverityBucket } from "../../components/charts/SeverityStackedBar";
import type { DonutSegmentInput } from "../../components/charts/DonutChart";
import type { HourlyPoint } from "../../components/charts/HourlyAreaChart";
import type { TimelineItemProps } from "../../components/ui/timeline-item";
import { normalizeRiskLevel, type RiskLevel } from "../shared/risk.ts";

export type QueueRow = {
  id: string;
  patientName: string;
  mrn: string;
  modality: string;
  summary: string;
  risk: RiskLevel;
  confidence: number | null;
  minutesInQueue: number | null;
  receivedAt: string;
};

export type AlertRow = {
  id: string;
  label: string;
  patientName: string;
  detail: string;
  severity: RiskLevel;
  elapsedMinutes: number | null;
  slaMinutes: number;
  /** 0–100 share of the SLA consumed, null when unknown */
  slaPercent: number | null;
};

export type ActivityGroup = { hour: string; items: Array<{ id: string; time: string; title: string; detail: string; type: TimelineItemProps["type"] }> };

export type DashboardViewData = {
  riskWindowDays: number;
  trendDays: number;
  metrics: StatCardProps[];
  reportsByRisk: SeverityBucket[];
  reportsByRiskCaption: string | null;
  modality: DonutSegmentInput[];
  modalityTotal: number;
  hourly: HourlyPoint[];
  hourlyTarget: number | null;
  hourlyCaption: string | null;
  queue: QueueRow[];
  reportsTotal: number;
  alerts: AlertRow[];
  insight: { title: string; summary: string; confidence: number; basis?: string };
  riskDistribution: SeverityBucket[];
  activity: ActivityGroup[];
};

// One hue at stepped opacity for categorical mixes (design rule: no rainbow)
const MODALITY_OPACITY = [1, 0.65, 0.4, 0.25, 0.15];

export function formatActivityTime(isoTimestamp: string | null, now: Date = new Date()): string {
  if (!isoTimestamp) return "—";
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "—";
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatMinutes(minutes: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / (60 * 24))}d`;
}

function activityType(eventType: string): TimelineItemProps["type"] {
  if (eventType.includes("report")) return "report";
  if (eventType.includes("triage")) return "triage";
  if (eventType.includes("copilot")) return "copilot";
  if (eventType.includes("alert") || eventType.includes("critical")) return "alert";
  if (eventType.includes("medication")) return "medication";
  return "other";
}

function toBuckets(buckets: DashboardSummaryResponse["risk_distribution"]): SeverityBucket[] {
  return buckets
    .map((bucket) => ({ level: normalizeRiskLevel(bucket.label), value: bucket.value }))
    .filter((bucket): bucket is SeverityBucket => bucket.level !== null);
}

export function mapDashboardSummary(summary: DashboardSummaryResponse, now: Date = new Date()): DashboardViewData {
  const groups = new Map<string, ActivityGroup>();
  for (const item of summary.recent_activity) {
    const time = formatActivityTime(item.timestamp, now);
    const hour = time.includes(":") ? `${time.slice(0, 2)}:00` : time;
    const group = groups.get(hour) ?? { hour, items: [] };
    group.items.push({
      id: item.id,
      time,
      title: item.patient_name ? `${item.patient_name} — ${item.label}` : item.label,
      detail: item.detail,
      type: activityType(item.event_type),
    });
    groups.set(hour, group);
  }

  return {
    riskWindowDays: summary.risk_window_days,
    trendDays: summary.trend_days,
    metrics: summary.metrics.map((metric) => ({
      label: metric.label,
      value: metric.value ?? "—",
      unit: metric.value != null ? metric.unit ?? undefined : undefined,
      secondary: metric.secondary
        ? { value: metric.secondary.value, label: metric.secondary.label, tone: normalizeRiskLevel(metric.secondary.tone) ?? undefined }
        : undefined,
      delta: metric.delta
        ? {
            direction: metric.delta.direction,
            label: metric.delta.label,
            tone: metric.id === "high-risk" && metric.delta.direction === "up" ? "Critical" : "accent",
          }
        : undefined,
      series: metric.series ?? undefined,
      seriesLabel: `${metric.label}, ${summary.trend_days}-day trend`,
      footnote: metric.footnote ?? metric.trend_label,
    })),
    reportsByRisk: toBuckets(summary.reports_by_risk),
    reportsByRiskCaption: summary.reports_by_risk_caption,
    modality: summary.modality_mix.map((entry, index) => ({
      label: entry.label,
      value: entry.value,
      color: "var(--rs-data-2)",
      opacity: MODALITY_OPACITY[Math.min(index, MODALITY_OPACITY.length - 1)],
    })),
    modalityTotal: summary.modality_total,
    hourly: summary.hourly.map((h) => ({ label: h.label, value: h.value })),
    hourlyTarget: summary.hourly_target,
    hourlyCaption: summary.hourly_caption,
    queue: summary.reports_queue.map((row) => ({
      id: row.id,
      patientName: row.patient_name,
      mrn: row.mrn ?? row.patient_id.replace(/^MRN\s*/, ""),
      modality: row.modality,
      summary: row.summary,
      risk: normalizeRiskLevel(row.risk) ?? "Low",
      confidence: row.confidence,
      minutesInQueue: row.minutes_in_queue,
      receivedAt: formatActivityTime(row.received_at, now),
    })),
    reportsTotal: summary.reports_total,
    alerts: summary.urgent_alerts.map((alert) => ({
      id: alert.id,
      label: alert.label,
      patientName: alert.patient_name,
      detail: alert.detail,
      severity: normalizeRiskLevel(alert.severity) ?? "High",
      elapsedMinutes: alert.elapsed_minutes,
      slaMinutes: alert.sla_minutes,
      slaPercent: alert.elapsed_minutes == null ? null : Math.min(100, Math.round((100 * alert.elapsed_minutes) / Math.max(1, alert.sla_minutes))),
    })),
    insight: {
      title: summary.ai_insight.title,
      summary: summary.ai_insight.summary,
      confidence: summary.ai_insight.confidence,
      basis: summary.ai_insight.record_count != null ? `Based on ${summary.ai_insight.record_count} record${summary.ai_insight.record_count === 1 ? "" : "s"}` : undefined,
    },
    riskDistribution: toBuckets(summary.risk_distribution),
    activity: [...groups.values()],
  };
}
