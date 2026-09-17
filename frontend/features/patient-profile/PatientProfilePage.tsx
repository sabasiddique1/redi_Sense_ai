"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, SkeletonCard } from "../shared/PageStates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Phone, Calendar, AlertTriangle, CheckCircle } from "lucide-react";
import { mockPatientProfile } from "../mock-data/patient-profile";
import { apiClient, ApiError } from "@/lib/api";
import type { PatientProfileResponse } from "@/lib/contracts";
import { useAppState } from "@/hooks/useAppState";

type PatientView = typeof mockPatientProfile;

function mapPatientResponseToView(payload: PatientProfileResponse): PatientView {
  return {
    name: payload.name,
    mrn: payload.mrn ?? "N/A",
    dob: payload.dob ?? "N/A",
    gender: payload.gender ?? "Unknown",
    overview: {
      "Primary care": payload.primary_clinician ?? "Not provided",
      Allergies: payload.allergies.join(", ") || "None listed",
      "Pre-existing": payload.conditions.join(", ") || "None listed",
      "Last lab": String(payload.profile_metadata.last_lab ?? "Not provided"),
      ASA: String(payload.profile_metadata.asa_classification ?? "Not provided"),
      "ICU need": String(payload.profile_metadata.icu_need ?? "Not provided"),
    },
    reports: payload.recent_reports.map((report) => ({
      id: String(report.id),
      modality: report.title ?? report.classification ?? report.modality ?? "Report",
      date: new Date(report.created_at).toLocaleDateString(),
      status: report.summary ? "Reviewed" : "Pending",
    })),
    medications: payload.medications,
    history: payload.history_summary ?? "No history summary available.",
    aiNotes: payload.ai_notes ?? "No AI notes available.",
    alerts: payload.alerts,
    tasks: payload.tasks,
  };
}

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
      summary: null,
      created_at: new Date().toISOString(),
    })),
    created_at: new Date().toISOString(),
  };
}

export function PatientProfilePage() {
  const { demoMode, selectedPatientId, activityVersion, hydrated } = useAppState();
  const [activeTab, setActiveTab] = useState("overview");
  const [patient, setPatient] = useState<PatientView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (!selectedPatientId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadPatient = async () => {
      setLoading(true);
      try {
        const result = await apiClient.fetchPatient(selectedPatientId, {
          demoMode,
          fallback: buildDemoPatientResponse,
          fallbackMessage: "Demo mode is enabled. Showing demo profile data.",
        });
        if (cancelled) {
          return;
        }
        setPatient(mapPatientResponseToView(result.data));
        setError(result.warning ?? null);
      } catch (caughtError) {
        if (cancelled) {
          return;
        }
        setError(
          caughtError instanceof ApiError
            ? caughtError.message
            : "Unable to load the connected patient profile.",
        );
        if (!demoMode) {
          setPatient(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPatient();

    return () => {
      cancelled = true;
    };
  }, [activityVersion, demoMode, selectedPatientId, hydrated]);

  const displayedPatient = selectedPatientId ? patient : null;

  if (!displayedPatient) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Patient Profile"
          subtitle="Clinical overview, reports, medications, and AI-assisted notes."
        />
        {loading ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" aria-busy="true">
            <div className="space-y-4">
              <SkeletonCard lines={3} />
              <SkeletonCard lines={5} />
            </div>
            <div className="space-y-4">
              <SkeletonCard lines={2} />
              <SkeletonCard lines={3} />
            </div>
          </div>
        ) : error ? (
          <ErrorState
            title="The connected patient profile is unavailable"
            description={error}
          />
        ) : (
          <EmptyState
            icon={User}
            title="No patient selected"
            description="Choose a patient from the top navigation to load the connected profile."
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Patient Profile"
        subtitle="Clinical overview, reports, medications, and AI-assisted notes."
      />

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Main content */}
        <div className="space-y-4 lg:col-span-8">
          <Card className="rounded-[20px] border border-border-subtle bg-surface shadow-soft">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-2xl font-semibold text-primary">
                  <User className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-text-primary">
                  {displayedPatient.name}
                </h2>
                <p className="text-xs text-text-secondary">
                  MRN {displayedPatient.mrn} · DOB {displayedPatient.dob} · {displayedPatient.gender}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    Call
                  </Button>
                  <Button size="sm" className="gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Schedule visit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="inline-flex items-center gap-1 rounded-full bg-surface-subtle p-1">
              {(["overview", "reports", "medications", "history", "ai-notes"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-pill-active text-surface"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {tab === "ai-notes" ? "AI notes" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {activeTab === "overview" && (
            <Card className="rounded-[20px] border border-border-subtle bg-surface p-5 shadow-soft">
                <div className="grid gap-4 sm:grid-cols-2">
                  {Object.entries(displayedPatient.overview).map(([k, v]) => (
                    <div key={k} className="rounded-[14px] bg-surface-muted px-3 py-2">
                      <p className="text-[11px] text-text-secondary">{k}</p>
                      <p className="text-xs font-medium text-text-primary">{v}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {activeTab === "reports" && (
              <Card className="rounded-[20px] border border-border-subtle bg-surface p-5 shadow-soft">
                <ul className="space-y-2">
                  {displayedPatient.reports.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between rounded-[14px] bg-surface-muted px-3 py-2"
                    >
                      <span className="text-xs font-medium text-text-primary">
                        {r.modality} — {r.date}
                      </span>
                      <Badge tone="outline">{r.status}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {activeTab === "medications" && (
              <Card className="rounded-[20px] border border-border-subtle bg-surface p-5 shadow-soft">
                <ul className="space-y-2">
                  {displayedPatient.medications.map((m) => (
                    <li
                      key={m}
                      className="rounded-[14px] bg-surface-muted px-3 py-2 text-xs text-text-primary"
                    >
                      {m}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {activeTab === "history" && (
              <Card className="rounded-[20px] border border-border-subtle bg-surface p-5 shadow-soft">
                <p className="text-xs text-text-secondary">{displayedPatient.history}</p>
              </Card>
            )}
            {activeTab === "ai-notes" && (
              <Card className="rounded-[20px] border border-border-subtle bg-surface p-5 shadow-soft">
                <p className="text-xs text-text-secondary">{displayedPatient.aiNotes}</p>
              </Card>
            )}
          </div>
        </div>

        {/* Sidebar: Alerts + Tasks */}
        <div className="space-y-4 lg:col-span-4">
          <Card className="rounded-[20px] border border-border-subtle bg-surface shadow-soft">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-danger" />
                <CardTitle className="text-sm font-semibold text-text-primary">
                  Alerts
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {displayedPatient.alerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-2 rounded-[14px] bg-danger-soft px-3 py-2"
                >
                  <span className="text-red-500">●</span>
                  <div>
                    <p className="text-xs font-medium text-danger-text">{a.label}</p>
                    <p className="text-[11px] text-danger-strong">{a.detail}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[20px] border border-border-subtle bg-surface shadow-soft">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold text-text-primary">
                  Tasks
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {displayedPatient.tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-[14px] bg-surface-muted px-3 py-2"
                >
                  <p className="text-xs text-text-primary">{t.label}</p>
                  <Badge tone={t.status === "Done" ? "success" : "default"}>
                    {t.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      {error ? <p className="text-[11px] text-warning-text">{error}</p> : null}
    </div>
  );
}
