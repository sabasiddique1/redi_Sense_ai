"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { demoMode, selectedPatientId, activityVersion } = useAppState();
  const [activeTab, setActiveTab] = useState("overview");
  const [patient, setPatient] = useState<PatientView | null>(demoMode ? mockPatientProfile : null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPatientId) {
      return;
    }

    let cancelled = false;

    const loadPatient = async () => {
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
      }
    };

    void loadPatient();

    return () => {
      cancelled = true;
    };
  }, [activityVersion, demoMode, selectedPatientId]);

  const displayedPatient = selectedPatientId ? patient : demoMode ? mockPatientProfile : null;

  if (!displayedPatient) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Patient Profile"
          subtitle="Clinical overview, reports, medications, and AI-assisted notes."
        />
        <Card className="rounded-[20px] border border-[#E6ECF5] bg-white p-12 text-center shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
          <p className="text-sm text-[#98A2B3]">
            {error
              ? "The connected patient profile is unavailable. Restore the backend service or enable demo mode explicitly."
              : "Select a patient to load the connected profile."}
          </p>
          {error ? <p className="mt-3 text-[11px] text-[#B42318]">{error}</p> : null}
        </Card>
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
          <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EAF2FF] text-2xl font-semibold text-[#4C8DFF]">
                  <User className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-[#101828]">
                  {displayedPatient.name}
                </h2>
                <p className="text-xs text-[#667085]">
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
            <div className="inline-flex items-center gap-1 rounded-full bg-[#F2F4F7] p-1">
              {(["overview", "reports", "medications", "history", "ai-notes"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-[#111111] text-white"
                      : "text-[#667085] hover:text-[#101828]"
                  }`}
                >
                  {tab === "ai-notes" ? "AI notes" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {activeTab === "overview" && (
            <Card className="rounded-[20px] border border-[#E6ECF5] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
                <div className="grid gap-4 sm:grid-cols-2">
                  {Object.entries(displayedPatient.overview).map(([k, v]) => (
                    <div key={k} className="rounded-[14px] bg-[#F8FAFD] px-3 py-2">
                      <p className="text-[11px] text-[#667085]">{k}</p>
                      <p className="text-xs font-medium text-[#101828]">{v}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {activeTab === "reports" && (
              <Card className="rounded-[20px] border border-[#E6ECF5] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
                <ul className="space-y-2">
                  {displayedPatient.reports.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between rounded-[14px] bg-[#F8FAFD] px-3 py-2"
                    >
                      <span className="text-xs font-medium text-[#101828]">
                        {r.modality} — {r.date}
                      </span>
                      <Badge tone="outline">{r.status}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {activeTab === "medications" && (
              <Card className="rounded-[20px] border border-[#E6ECF5] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
                <ul className="space-y-2">
                  {displayedPatient.medications.map((m) => (
                    <li
                      key={m}
                      className="rounded-[14px] bg-[#F8FAFD] px-3 py-2 text-xs text-[#101828]"
                    >
                      {m}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {activeTab === "history" && (
              <Card className="rounded-[20px] border border-[#E6ECF5] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
                <p className="text-xs text-[#667085]">{displayedPatient.history}</p>
              </Card>
            )}
            {activeTab === "ai-notes" && (
              <Card className="rounded-[20px] border border-[#E6ECF5] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
                <p className="text-xs text-[#667085]">{displayedPatient.aiNotes}</p>
              </Card>
            )}
          </div>
        </div>

        {/* Sidebar: Alerts + Tasks */}
        <div className="space-y-4 lg:col-span-4">
          <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#EF4444]" />
                <CardTitle className="text-sm font-semibold text-[#101828]">
                  Alerts
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {displayedPatient.alerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-2 rounded-[14px] bg-[#FEF2F2] px-3 py-2"
                >
                  <span className="text-red-500">●</span>
                  <div>
                    <p className="text-xs font-medium text-[#B91C1C]">{a.label}</p>
                    <p className="text-[11px] text-[#7F1D1D]">{a.detail}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-[#4C8DFF]" />
                <CardTitle className="text-sm font-semibold text-[#101828]">
                  Tasks
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {displayedPatient.tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-[14px] bg-[#F8FAFD] px-3 py-2"
                >
                  <p className="text-xs text-[#101828]">{t.label}</p>
                  <Badge tone={t.status === "Done" ? "success" : "default"}>
                    {t.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      {error ? <p className="text-[11px] text-[#B45309]">{error}</p> : null}
    </div>
  );
}
