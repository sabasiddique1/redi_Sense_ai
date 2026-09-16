import type { Metric } from "../shared/MetricCard";
import type { ReportRow } from "../shared/ReportsTable";
import type { UrgentAlert } from "../shared/AlertCard";
import type { Insight } from "../shared/InsightCard";
import type { RiskBucket } from "../shared/RiskDistributionChart";
import type { RecentActivityItem } from "../shared/RecentActivityPanel";
import type {
  DashboardRiskLevel,
  DashboardSummaryResponse,
} from "../../lib/contracts";
import { riskClasses } from "../shared/risk.ts";

interface DashboardMockData {
  metrics: Metric[];
  reportsQueue: ReportRow[];
  urgentAlerts: UrgentAlert[];
  aiInsight: Insight;
  riskDistribution: RiskBucket[];
  recentActivity: RecentActivityItem[];
}

export const mockDashboardData: DashboardMockData = {
  metrics: [
    {
      id: "reports-today",
      label: "Reports analyzed today",
      value: "38",
      trend: "up",
      trendLabel: "+12% vs. typical Monday",
      pill: "AI-assisted",
    },
    {
      id: "high-risk",
      label: "High / critical risk",
      value: "6",
      trend: "neutral",
      trendLabel: "All acknowledged",
      pill: "Safety",
    },
    {
      id: "triage-time",
      label: "Median triage time",
      value: "7.4 min",
      trend: "down",
      trendLabel: "-2.1 min vs. last week",
      pill: "Efficiency",
    },
    {
      id: "evidence-linked",
      label: "Reports with guideline links",
      value: "82%",
      trend: "up",
      trendLabel: "Consistent evidence coverage",
      pill: "Evidence",
    },
  ],
  reportsQueue: [
    {
      id: "r1",
      patientName: "Nguyen, Lien",
      patientId: "MRN 184920",
      modality: "CT chest w/ contrast",
      summary:
        "AI notes interval enlargement of a right upper lobe nodule with subtle spiculation.",
      risk: "High",
      receivedAt: "08:12",
    },
    {
      id: "r2",
      patientName: "Ali, Samir",
      patientId: "MRN 102384",
      modality: "MRI brain",
      summary:
        "New diffusion restriction in left MCA territory concerning for acute ischemia.",
      risk: "Critical",
      receivedAt: "08:24",
    },
    {
      id: "r3",
      patientName: "Jones, Maya",
      patientId: "MRN 998241",
      modality: "CXR portable",
      summary: "Findings suggest evolving pulmonary edema on a CHF background.",
      risk: "Moderate",
      receivedAt: "08:41",
    },
    {
      id: "r4",
      patientName: "Garcia, Luis",
      patientId: "MRN 552103",
      modality: "Abdominal ultrasound",
      summary:
        "Stable benign-appearing hepatic cysts, no high-risk features detected.",
      risk: "Low",
      receivedAt: "09:02",
    },
  ],
  urgentAlerts: [
    {
      id: "a1",
      label: "Possible acute stroke",
      patientName: "Samir Ali",
      detail:
        "AI suggests emergent stroke protocol activation based on new diffusion restriction.",
      severity: "Critical",
    },
    {
      id: "a2",
      label: "Incidental PE risk",
      patientName: "Lien Nguyen",
      detail:
        "Segmental pulmonary embolus not clearly mentioned in dictated impression.",
      severity: "High",
    },
  ],
  aiInsight: {
    id: "insight-1",
    title: "Most missed discrepancies arise from evolving follow-up findings",
    summary:
      "Across your last 200 reports, 63% of clinically relevant discrepancies were related to interval changes in known lesions or previously labeled 'incidental' findings. Consistently tracking prior imaging and structured follow-up recommendations can reduce late escalations.",
    confidence: 89,
  },
  riskDistribution: [
    { label: "Low", value: 48, color: riskClasses("Low").bar },
    { label: "Moderate", value: 23, color: riskClasses("Moderate").bar },
    { label: "High", value: 9, color: riskClasses("High").bar },
    { label: "Critical", value: 4, color: riskClasses("Critical").bar },
  ],
  recentActivity: [
    {
      id: "ra1",
      time: "08:32",
      label: "AI summary accepted",
      detail: "RediSense summary attached to MRI brain report for S. Ali.",
    },
    {
      id: "ra2",
      time: "08:25",
      label: "Stroke alert acknowledged",
      detail: "Critical alert routed to ED stroke pager.",
    },
    {
      id: "ra3",
      time: "08:17",
      label: "Evidence pack viewed",
      detail: "AHA/ASA stroke guidelines opened from AI panel.",
    },
  ],
};


const RISK_LEVELS: DashboardRiskLevel[] = ["Low", "Moderate", "High", "Critical"];

function todayAt(hhmm: string): string {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const date = new Date();
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date.toISOString();
}

/** The demo snapshot in the same shape the backend returns, so the page has one render path. */
export function buildDemoDashboardSummary(): DashboardSummaryResponse {
  const data = mockDashboardData;
  return {
    generated_at: new Date().toISOString(),
    risk_window_days: 7,
    metrics: data.metrics.map((metric) => ({
      id: metric.id,
      label: metric.label,
      value: metric.value,
      trend: metric.trend,
      trend_label: metric.trendLabel,
      pill: metric.pill ?? null,
    })),
    reports_queue: data.reportsQueue.map((row) => ({
      id: row.id,
      patient_name: row.patientName,
      patient_id: row.patientId,
      modality: row.modality,
      summary: row.summary,
      risk: row.risk,
      received_at: todayAt(row.receivedAt),
    })),
    urgent_alerts: data.urgentAlerts.map((alert) => ({
      id: alert.id,
      label: alert.label,
      patient_name: alert.patientName,
      detail: alert.detail,
      severity: alert.severity,
    })),
    ai_insight: { ...data.aiInsight, record_count: null },
    risk_distribution: data.riskDistribution
      .filter((bucket): bucket is RiskBucket & { label: DashboardRiskLevel } =>
        (RISK_LEVELS as string[]).includes(bucket.label),
      )
      .map((bucket) => ({ label: bucket.label, value: bucket.value })),
    recent_activity: data.recentActivity.map((item) => ({
      id: item.id,
      timestamp: todayAt(item.time),
      label: item.label,
      detail: item.detail,
      event_type: "demo",
      patient_id: null,
    })),
    disclaimer: "Clinical decision support only. Verify findings with licensed clinical judgment.",
    mode: "real",
  };
}
