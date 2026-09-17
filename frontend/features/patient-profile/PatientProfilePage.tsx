"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, User } from "lucide-react";

import { Sparkline, SparklineEmpty } from "@/components/charts/Sparkline";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ModeBadge } from "@/components/ui/mode-badge";
import { MrnChip } from "@/components/ui/mrn-chip";
import { SeverityChip } from "@/components/ui/severity-chip";
import { TimelineItem } from "@/components/ui/timeline-item";
import { cn } from "@/components/ui/cn";
import { useAppState } from "@/hooks/useAppState";
import { apiClient, ApiError } from "@/lib/api";
import type { PatientProfileResponse, ResultMode, TimelineEventResponse } from "@/lib/contracts";
import { mockPatientProfile, mockVitalsHistory } from "../mock-data/patient-profile";
import { PageHeader } from "../shared/PageHeader";
import { EmptyState, ErrorState, SkeletonCard } from "../shared/PageStates";
import { mapTimelineEvent, type TimelineViewEvent } from "../timeline/view-model";

type ReportRow = PatientProfileResponse["recent_reports"][number];

function buildDemoPatientResponse(): PatientProfileResponse {
  return {
    id: 1,
    mrn: mockPatientProfile.mrn,
    name: mockPatientProfile.name,
    dob: mockPatientProfile.dob,
    gender: mockPatientProfile.gender,
    primary_clinician: mockPatientProfile.overview["Primary care"],
    allergies: mockPatientProfile.overview["Allergies"].split(", ").filter(Boolean),
    conditions: mockPatientProfile.overview["Pre-existing"].split(", ").filter(Boolean),
    medications: mockPatientProfile.medications,
    history_summary: mockPatientProfile.history,
    ai_notes: mockPatientProfile.aiNotes,
    profile_metadata: {
      last_lab: mockPatientProfile.overview["Last lab"],
      asa_classification: mockPatientProfile.overview.ASA,
      icu_need: mockPatientProfile.overview["ICU need"],
    },
    alerts: mockPatientProfile.alerts,
    tasks: mockPatientProfile.tasks,
    recent_reports: mockPatientProfile.reports.map((report) => ({
      id: Number(report.id),
      patient_id: 1,
      title: report.modality,
      modality: report.modality,
      classification: report.status,
      summary: report.summary,
      created_at: `${report.date}T09:00:00Z`,
    })),
    created_at: new Date().toISOString(),
  };
}

function ageSex(dob: string | null, gender: string | null): string | null {
  const parts: string[] = [];
  if (dob) {
    const birth = new Date(dob);
    if (!Number.isNaN(birth.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age -= 1;
      parts.push(String(age));
    }
  }
  if (gender) parts.push(gender.charAt(0).toUpperCase());
  return parts.length ? parts.join(" / ") : null;
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md bg-surface-sunken px-3 py-2">
      <p className="text-2xs text-ink-500">{label}</p>
      <p className={cn("text-xs font-medium text-ink-900", mono && "font-mono rs-tabular")}>{value}</p>
    </div>
  );
}

export function PatientProfilePage() {
  const { demoMode, selectedPatientId, activityVersion, hydrated } = useAppState();
  const [patient, setPatient] = useState<PatientProfileResponse | null>(null);
  const [events, setEvents] = useState<TimelineViewEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ResultMode>("real");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!selectedPatientId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [profile, timeline] = await Promise.all([
          apiClient.fetchPatient(selectedPatientId, { demoMode, fallback: buildDemoPatientResponse, fallbackMessage: "Demo mode is enabled. Showing demo profile data." }),
          apiClient.fetchTimeline(selectedPatientId, { demoMode, fallback: (): TimelineEventResponse[] => [], fallbackMessage: undefined }),
        ]);
        if (cancelled) return;
        setPatient(profile.data);
        setEvents(timeline.data.map(mapTimelineEvent));
        setMode(profile.mode);
        setError(profile.warning ?? null);
      } catch (caughtError) {
        if (cancelled) return;
        setError(caughtError instanceof ApiError ? caughtError.message : "Unable to load the connected patient profile.");
        setMode("error");
        if (!demoMode) setPatient(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [activityVersion, demoMode, selectedPatientId, hydrated]);

  const triageSessions = useMemo(() => events.filter((e) => e.type === "triage").slice(0, 6), [events]);
  const riskTrend = useMemo(() => {
    const sessions = [...triageSessions].reverse();
    return { values: sessions.map((s) => (s.risk ? ["Low", "Moderate", "High", "Critical"].indexOf(s.risk) : 0)), markers: sessions.map((s) => s.risk) };
  }, [triageSessions]);
  const lastVisit = events[0]?.date ?? null;
  const vitalsHistory = demoMode ? mockVitalsHistory : null;

  const reportColumns: DataTableColumn<ReportRow>[] = [
    { id: "date", header: "Date", mono: true, cell: (row) => new Date(row.created_at).toLocaleDateString([], { year: "numeric", month: "2-digit", day: "2-digit" }) },
    { id: "modality", header: "Modality", cell: (row) => <span className="font-semibold text-ink-900">{row.title ?? row.modality ?? row.classification ?? "Report"}</span> },
    { id: "summary", header: "Summary", cell: (row) => <span className="line-clamp-2">{row.summary ?? "No summary recorded"}</span>, width: "45%" },
    // TODO(backend): ReportListItem.risk — recent_reports carry no derived risk; the dashboard derives it from structured_data.safety_flags.
    { id: "risk", header: "Risk", cell: () => <span className="text-2xs text-ink-400">Not scored</span> },
  ];

  if (!selectedPatientId || (!patient && !loading)) {
    return (
      <div className="space-y-5">
        <PageHeader title="Patient Profile" subtitle="Clinical overview, reports, medications, and AI-assisted notes." />
        {error ? <ErrorState title="The connected patient profile is unavailable" description={error} /> : <EmptyState icon={User} title="No patient selected" description="Choose a patient from the top navigation to load the connected profile." />}
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="space-y-5" aria-busy="true">
        <PageHeader title="Patient Profile" subtitle="Clinical overview, reports, medications, and AI-assisted notes." />
        <SkeletonCard lines={2} />
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
        <SkeletonCard lines={3} />
      </div>
    );
  }

  const initials = patient.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const allergies = patient.allergies.filter(Boolean);
  const latestRisk = triageSessions[0]?.risk ?? null;

  return (
    <div className="space-y-5">
      <PageHeader title="Patient Profile" subtitle="Clinical overview, reports, medications, and AI-assisted notes." />
      <div className="flex flex-wrap items-center gap-2 text-2xs text-ink-500">
        <ModeBadge mode={mode} />
        {error && mode !== "error" ? <span>{error}</span> : null}
      </div>

      <section className="card-surface flex flex-wrap items-center gap-5 p-5" aria-label="Patient header">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-100 text-sm font-semibold text-accent-700" aria-hidden="true">{initials}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-ink-900">{patient.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
            <MrnChip name={patient.name} mrn={patient.mrn} ageSex={ageSex(patient.dob, patient.gender)} riskLevel={latestRisk} compact className="text-xs" />
            {ageSex(patient.dob, patient.gender) ? <span>· {ageSex(patient.dob, patient.gender)}</span> : null}
            {allergies.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-pill bg-severity-high-bg px-2 py-0.5 text-2xs font-semibold text-severity-high">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {allergies.join(", ")} allergy
              </span>
            ) : null}
            {patient.primary_clinician ? <span>· Primary: {patient.primary_clinician}</span> : null}
          </div>
        </div>
        <div className="w-[140px]">
          <p className="text-2xs text-ink-500">Risk trend · last {triageSessions.length || 6} sessions</p>
          <div className="mt-1 h-[30px]">
            {riskTrend.values.length >= 2 ? <Sparkline values={riskTrend.values} markers={riskTrend.markers} height={30} title="Risk trend across recent triage sessions" /> : <SparklineEmpty height={30} message="Fewer than 2 sessions" />}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-surface p-5" aria-labelledby="profile-demographics">
          <h2 id="profile-demographics" className="text-sm font-semibold text-ink-900">Demographics</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Field label="Date of birth" value={patient.dob ?? "Not recorded"} mono />
            {/* TODO(backend): patients.insurance and patients.language are not modelled yet. */}
            <Field label="Insurance" value={String(patient.profile_metadata.insurance ?? "Not recorded")} />
            <Field label="Language" value={String(patient.profile_metadata.language ?? "Not recorded")} />
            <Field label="Last visit" value={lastVisit ? lastVisit.toLocaleDateString([], { year: "numeric", month: "2-digit", day: "2-digit" }) : "No events yet"} mono />
            <Field label="Primary care" value={patient.primary_clinician ?? "Not recorded"} />
            <Field label="Last lab" value={String(patient.profile_metadata.last_lab ?? "Not recorded")} mono />
          </div>
          {patient.medications.length > 0 ? (
            <div className="mt-3">
              <p className="text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">Medications</p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {patient.medications.map((medication) => (
                  <li key={medication} className="rounded-pill border border-border-hairline px-2.5 py-0.5 text-2xs text-ink-700">{medication}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="card-surface p-5" aria-labelledby="profile-conditions">
          <h2 id="profile-conditions" className="text-sm font-semibold text-ink-900">Active conditions</h2>
          {/* TODO(backend): conditions carry no onset/resolved dates, so the design's year axis is demo-only. */}
          {patient.conditions.length === 0 ? (
            <p className="mt-3 text-xs text-ink-400">No conditions recorded.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {patient.conditions.map((condition) => (
                <li key={condition} className="flex items-center justify-between gap-3 rounded-md bg-surface-sunken px-3 py-2 text-xs">
                  <span className="font-medium text-ink-900">{condition}</span>
                  <span className="text-2xs text-ink-400">{demoMode ? "since 2015" : "onset not recorded"}</span>
                </li>
              ))}
            </ul>
          )}
          {patient.history_summary ? <p className="mt-3 text-2xs leading-relaxed text-ink-500">{patient.history_summary}</p> : null}
        </section>
      </div>

      <section className="card-surface p-5" aria-labelledby="profile-vitals">
        <div className="flex items-baseline justify-between">
          <h2 id="profile-vitals" className="text-sm font-semibold text-ink-900">Vitals history</h2>
          <span className="text-2xs text-ink-500">Last 30 days</span>
        </div>
        {vitalsHistory ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {vitalsHistory.map((vital) => (
              <div key={vital.label}>
                <p className="text-2xs font-semibold uppercase tracking-[0.04em] text-ink-500">
                  {vital.label} <span className="font-normal normal-case tracking-normal text-ink-400">{vital.unit}</span>
                </p>
                <div className="mt-2 h-[40px]">
                  <Sparkline values={vital.values} secondary={vital.secondary} height={40} stroke={vital.stroke} title={`${vital.label}, last 30 days`} />
                </div>
                <p className="mt-1 text-2xs text-ink-700">{vital.caption}</p>
              </div>
            ))}
          </div>
        ) : (
          // TODO(backend): a vitals table (patient_id, taken_at, systolic, diastolic, hr, spo2) would feed these charts.
          <p className="mt-3 rounded-md border border-dashed border-border-strong px-3 py-3 text-2xs text-ink-500">Not available — needs vitals history. Triage sessions capture vitals at intake but they are not persisted as a series yet.</p>
        )}
      </section>

      <section className="card-surface p-5" aria-labelledby="profile-reports">
        <h2 id="profile-reports" className="text-sm font-semibold text-ink-900">Recent reports</h2>
        <div className="mt-3">
          <DataTable caption="Recent reports" columns={reportColumns} rows={patient.recent_reports} rowKey={(row) => String(row.id)} emptyMessage="No reports on record." />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card-surface p-5" aria-labelledby="profile-triage">
          <h2 id="profile-triage" className="text-sm font-semibold text-ink-900">Recent triage sessions</h2>
          {triageSessions.length === 0 ? (
            <p className="mt-3 text-xs text-ink-400">No triage sessions recorded for this patient.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {triageSessions.map((session) => (
                <TimelineItem key={session.id} time={session.date.toLocaleDateString([], { month: "short", day: "numeric" })} title={session.title} detail={session.detail} type="triage" risk={session.risk} />
              ))}
            </ol>
          )}
        </section>
        <div className="space-y-4">
          <section className="card-surface p-5" aria-labelledby="profile-alerts">
            <h2 id="profile-alerts" className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <AlertTriangle className="h-4 w-4 text-severity-critical" aria-hidden="true" />
              Alerts
            </h2>
            {patient.alerts.length === 0 ? (
              <p className="mt-3 text-xs text-ink-400">No alerts on file.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {patient.alerts.map((alert) => (
                  <li key={alert.id} className="rounded-md border border-severity-high/30 bg-severity-high-bg px-3 py-2">
                    <p className="text-xs font-semibold text-severity-high">{alert.label}</p>
                    <p className="text-2xs text-ink-700">{alert.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card-surface p-5" aria-labelledby="profile-tasks">
            <h2 id="profile-tasks" className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <CheckCircle2 className="h-4 w-4 text-accent-600" aria-hidden="true" />
              Tasks
            </h2>
            {patient.tasks.length === 0 ? (
              <p className="mt-3 text-xs text-ink-400">No open tasks.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {patient.tasks.map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-2 rounded-md bg-surface-sunken px-3 py-2 text-xs">
                    <span className="text-ink-900">{task.label}</span>
                    <SeverityChip level={task.status === "Done" ? "Low" : task.status === "Pending" ? "Moderate" : null} label={task.status} showGlyph={false} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
