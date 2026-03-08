"use client";

import { useState } from "react";
import { PageHeader } from "../shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockPatientProfile } from "../mock-data/patient-profile";

export function PatientProfilePage() {
  const [activeTab, setActiveTab] = useState("overview");
  const patient = mockPatientProfile;

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
                {patient.name.charAt(0)}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-[#101828]">
                  {patient.name}
                </h2>
                <p className="text-xs text-[#667085]">
                  MRN {patient.mrn} · DOB {patient.dob} · {patient.gender}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button variant="outline" size="sm">
                    Call
                  </Button>
                  <Button size="sm">Schedule visit</Button>
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
                  {Object.entries(patient.overview).map(([k, v]) => (
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
                  {patient.reports.map((r) => (
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
                  {patient.medications.map((m) => (
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
                <p className="text-xs text-[#667085]">{patient.history}</p>
              </Card>
            )}
            {activeTab === "ai-notes" && (
              <Card className="rounded-[20px] border border-[#E6ECF5] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
                <p className="text-xs text-[#667085]">{patient.aiNotes}</p>
              </Card>
            )}
          </div>
        </div>

        {/* Sidebar: Alerts + Tasks */}
        <div className="space-y-4 lg:col-span-4">
          <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#101828]">
                Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {patient.alerts.map((a) => (
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
              <CardTitle className="text-sm font-semibold text-[#101828]">
                Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {patient.tasks.map((t) => (
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
    </div>
  );
}
