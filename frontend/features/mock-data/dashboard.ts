import type { DashboardSummaryResponse } from "../../lib/contracts";

function todayAt(hhmm: string): string {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const date = new Date();
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date.toISOString();
}

/**
 * Demo dashboard snapshot in the backend's response shape, mirroring the
 * design canvas (design/RediSense Screens.dc.html, page 01). Names are demo
 * placeholders; connected mode always renders persisted data.
 */
export function buildDemoDashboardSummary(): DashboardSummaryResponse {
  return {
    generated_at: new Date().toISOString(),
    risk_window_days: 7,
    trend_days: 7,
    metrics: [
      {
        id: "reports-today",
        label: "Reports today",
        value: "128",
        unit: null,
        trend: "up",
        trend_label: "vs. 7-day avg 114",
        delta: { direction: "up", label: "12%" },
        series: [98, 110, 104, 121, 117, 109, 128],
        footnote: "vs. 7-day avg 114",
        pill: "AI-assisted",
        secondary: null,
      },
      {
        id: "high-risk",
        label: "High / Critical risk",
        value: "17",
        unit: null,
        trend: "down",
        trend_label: "13.3% of today's queue",
        delta: { direction: "up", label: "4" },
        series: [12, 9, 14, 11, 15, 13, 17],
        footnote: "13.3% of today's queue",
        pill: "Safety",
        secondary: { value: "4", label: "critical", tone: "Critical" },
      },
      {
        id: "triage-time",
        label: "Median triage time",
        value: "4.2",
        unit: "min",
        trend: "down",
        trend_label: "vs. last week 4.8 min",
        delta: { direction: "down", label: "0.6" },
        series: [5.1, 4.9, 4.8, 4.6, 4.7, 4.4, 4.2],
        footnote: "vs. last week 4.8 min",
        pill: "Efficiency",
        secondary: null,
      },
      {
        id: "evidence-linked",
        label: "Guideline-linked",
        value: "94",
        unit: "%",
        trend: "up",
        trend_label: "of AI outputs cite ≥1 source",
        delta: { direction: "up", label: "2pt" },
        series: [89, 90, 91, 92, 92, 93, 94],
        footnote: "of AI outputs cite ≥1 source",
        pill: "Evidence",
        secondary: null,
      },
    ],
    reports_by_risk: [
      { label: "Low", value: 67 },
      { label: "Moderate", value: 36 },
      { label: "High", value: 17 },
      { label: "Critical", value: 8 },
    ],
    reports_by_risk_caption: "20% of today's reports are High or Critical — above the 15% weekly baseline.",
    modality_mix: [
      { label: "CT", value: 58 },
      { label: "MRI", value: 32 },
      { label: "X-ray", value: 26 },
      { label: "US", value: 12 },
    ],
    modality_total: 128,
    hourly: [
      { label: "06:00", value: 6 },
      { label: "07:00", value: 15 },
      { label: "08:00", value: 22 },
      { label: "08:41", value: 19 },
    ],
    hourly_target: 14,
    hourly_caption: "Throughput has cleared the target line since 07:00 — queue is not backing up.",
    reports_queue: [
      { id: "r1", patient_name: "Alvarez, Marisol", patient_id: "MRN 0038-2291", mrn: "0038-2291", modality: "MRI brain w/o contrast", summary: "New 8mm enhancing lesion, left frontal", risk: "Critical", confidence: 92, received_at: todayAt("08:19"), minutes_in_queue: 22 },
      { id: "r2", patient_name: "Farrow, Diane", patient_id: "MRN 0027-5502", mrn: "0027-5502", modality: "CT abdomen/pelvis", summary: "Appendiceal wall thickening, 9mm", risk: "High", confidence: 78, received_at: todayAt("08:26"), minutes_in_queue: 15 },
      { id: "r3", patient_name: "Chen, Wei", patient_id: "MRN 0051-7743", mrn: "0051-7743", modality: "X-ray chest, 2 views", summary: "Right lower lobe consolidation", risk: "Moderate", confidence: 69, received_at: todayAt("08:33"), minutes_in_queue: 8 },
      { id: "r4", patient_name: "Okafor, Daniel", patient_id: "MRN 0042-8817", mrn: "0042-8817", modality: "CT chest w/ contrast", summary: "3mm nodule RUL, stable vs. prior", risk: "Low", confidence: 85, received_at: todayAt("08:38"), minutes_in_queue: 3 },
      { id: "r5", patient_name: "Nguyen, Lien", patient_id: "MRN 184920", mrn: "184920", modality: "CXR follow-up", summary: "Stable right upper lobe nodule at 8mm", risk: "Low", confidence: 88, received_at: todayAt("07:52"), minutes_in_queue: 49 },
    ],
    reports_total: 128,
    urgent_alerts: [
      { id: "a1", label: "Possible acute stroke", patient_name: "Alvarez, Marisol", detail: "New enhancing lesion — escalate to neuro", severity: "Critical", elapsed_minutes: 29, sla_minutes: 30 },
      { id: "a2", label: "Suspected appendicitis", patient_name: "Farrow, Diane", detail: "Surgical consult pending", severity: "High", elapsed_minutes: 15, sla_minutes: 30 },
    ],
    ai_insight: {
      id: "insight-1",
      title: "Critical and high-risk reports are up 22% this week",
      summary: "Concentrated in CT abdomen studies. Consider reviewing the appendicitis protocol queue first.",
      confidence: 89,
      record_count: null,
    },
    risk_distribution: [
      { label: "Low", value: 67 },
      { label: "Moderate", value: 36 },
      { label: "High", value: 17 },
      { label: "Critical", value: 8 },
    ],
    recent_activity: [
      { id: "ra1", timestamp: todayAt("08:41"), label: "Critical finding flagged, MRI brain", detail: "Alvarez, M.", event_type: "alert", patient_id: null, patient_name: "Alvarez, M." },
      { id: "ra2", timestamp: todayAt("08:22"), label: "Report analyzed, CT chest", detail: "Okafor, D.", event_type: "report_uploaded", patient_id: null, patient_name: "Okafor, D." },
      { id: "ra3", timestamp: todayAt("07:58"), label: "Triage escalated to attending", detail: "Farrow, D.", event_type: "triage_completed", patient_id: null, patient_name: "Farrow, D." },
    ],
    disclaimer: "Clinical decision support only. Verify findings with licensed clinical judgment.",
    mode: "real",
  };
}
