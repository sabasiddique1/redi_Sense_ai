import type { DashboardSummaryResponse } from "../../lib/contracts";
import type { Metric } from "../shared/MetricCard";
import type { ReportRow } from "../shared/ReportsTable";
import type { UrgentAlert } from "../shared/AlertCard";
import type { Insight } from "../shared/InsightCard";
import type { RiskBucket } from "../shared/RiskDistributionChart";
import type { RecentActivityItem } from "../shared/RecentActivityPanel";
import { normalizeRiskLevel, riskClasses } from "../shared/risk.ts";

export type DashboardViewData = {
  riskWindowDays: number;
  metrics: Metric[];
  reportsQueue: ReportRow[];
  urgentAlerts: UrgentAlert[];
  aiInsight: Insight;
  riskDistribution: RiskBucket[];
  recentActivity: RecentActivityItem[];
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
    riskWindowDays: summary.risk_window_days,
    metrics: summary.metrics.map((metric) => ({
      id: metric.id,
      label: metric.label,
      value: metric.value,
      trend: metric.trend,
      trendLabel: metric.trend_label,
      pill: metric.pill ?? undefined,
      accent:
        metric.id === "high-risk"
          ? Number(metric.value) > 0
            ? "Critical"
            : "Low"
          : undefined,
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
      color: riskClasses(normalizeRiskLevel(bucket.label)).bar,
    })),
    recentActivity: summary.recent_activity.map((item) => ({
      id: item.id,
      time: formatActivityTime(item.timestamp, now),
      label: item.label,
      detail: item.detail,
    })),
  };
}
