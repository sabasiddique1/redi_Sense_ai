import type { DashboardSummaryResponse } from "../../lib/contracts";
import type { Metric } from "../shared/MetricCard";
import type { ReportRow } from "../shared/ReportsTable";
import type { UrgentAlert } from "../shared/AlertCard";
import type { Insight } from "../shared/InsightCard";
import type { RiskBucket } from "../shared/RiskDistributionChart";
import type { RecentActivityItem } from "../shared/RecentActivityPanel";

export type DashboardViewData = {
  metrics: Metric[];
  reportsQueue: ReportRow[];
  urgentAlerts: UrgentAlert[];
  aiInsight: Insight;
  riskDistribution: RiskBucket[];
  recentActivity: RecentActivityItem[];
};

// Same swatches the demo snapshot uses; tokenised in the UI polish pass.
const RISK_BUCKET_COLORS: Record<string, string> = {
  Low: "bg-[#22C55E]",
  Moderate: "bg-[#F59E0B]",
  High: "bg-[#F97316]",
  Critical: "bg-[#EF4444]",
};

export function formatActivityTime(
  isoTimestamp: string | null,
  now: Date = new Date(),
): string {
  if (!isoTimestamp) {
    return "—";
  }
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function mapDashboardSummary(
  summary: DashboardSummaryResponse,
  now: Date = new Date(),
): DashboardViewData {
  return {
    metrics: summary.metrics.map((metric) => ({
      id: metric.id,
      label: metric.label,
      value: metric.value,
      trend: metric.trend,
      trendLabel: metric.trend_label,
      pill: metric.pill ?? undefined,
    })),
    reportsQueue: summary.reports_queue.map((row) => ({
      id: row.id,
      patientName: row.patient_name,
      patientId: row.patient_id,
      modality: row.modality,
      summary: row.summary,
      risk: row.risk,
      receivedAt: formatActivityTime(row.received_at, now),
    })),
    urgentAlerts: summary.urgent_alerts.map((alert) => ({
      id: alert.id,
      label: alert.label,
      patientName: alert.patient_name,
      detail: alert.detail,
      severity: alert.severity,
    })),
    aiInsight: {
      id: summary.ai_insight.id,
      title: summary.ai_insight.title,
      summary: summary.ai_insight.summary,
      confidence: summary.ai_insight.confidence,
    },
    riskDistribution: summary.risk_distribution.map((bucket) => ({
      label: bucket.label,
      value: bucket.value,
      color: RISK_BUCKET_COLORS[bucket.label] ?? "bg-[#98A2B3]",
    })),
    recentActivity: summary.recent_activity.map((item) => ({
      id: item.id,
      time: formatActivityTime(item.timestamp, now),
      label: item.label,
      detail: item.detail,
    })),
  };
}
