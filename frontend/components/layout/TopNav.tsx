"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Bot, FilePlus } from "lucide-react";

import { useAppState } from "@/hooks/useAppState";

export function TopNav({ onOpenCopilot }: { onOpenCopilot: () => void }) {
  const router = useRouter();
  const {
    demoMode,
    patients,
    patientsLoading,
    patientsWarning,
    selectedPatientId,
    setSelectedPatientId,
  } = useAppState();

  return (
    <header className="relative flex h-[72px] items-center justify-between gap-4 border-b border-[#E6ECF5] bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-[#101828]">
          Welcome back, Dr. Hernandez
        </h2>
        <span className="hidden sm:inline">
          <Bot className="h-5 w-5 text-[#4C8DFF]" />
        </span>
      </div>
      <div className="flex flex-1 items-center justify-end gap-3">
        <div className="hidden min-w-[220px] sm:block">
          <select
            value={selectedPatientId ?? ""}
            onChange={(event) => setSelectedPatientId(Number(event.target.value))}
            className="h-9 w-full rounded-[14px] border border-[#E6ECF5] bg-[#F8FAFD] px-3 text-sm text-[#101828]"
            disabled={patientsLoading || patients.length === 0}
          >
            {patients.length === 0 ? (
              <option value="">No patients available</option>
            ) : null}
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name} {patient.mrn ? `· MRN ${patient.mrn}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="hidden rounded-full bg-[#F2F4F7] px-3 py-1.5 text-[11px] font-medium text-[#667085] sm:block">
          {demoMode ? "Demo mode" : "Connected mode"}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="hidden rounded-[14px] gap-1.5 sm:inline-flex"
          onClick={() => router.push("/report-analyzer")}
        >
          <FilePlus className="h-4 w-4" />
          New report
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="rounded-[14px] gap-1.5"
          onClick={onOpenCopilot}
        >
          <Bot className="h-4 w-4" />
          Open Copilot
        </Button>
      </div>
      {patientsWarning ? (
        <p className="absolute right-6 top-[72px] hidden text-[11px] text-[#B45309] lg:block">
          {patientsWarning}
        </p>
      ) : null}
    </header>
  );
}
