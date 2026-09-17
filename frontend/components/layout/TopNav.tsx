"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Bot, FilePlus, Monitor, Moon, Sun } from "lucide-react";

import { useAppState } from "@/hooks/useAppState";
import { useTheme, type ThemePreference } from "@/components/providers/ThemeProvider";

const THEME_CYCLE: ThemePreference[] = ["light", "dark", "system"];
const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;
const THEME_LABELS = { light: "Light", dark: "Dark", system: "System" } as const;

export function TopNav({ onOpenCopilot }: { onOpenCopilot: () => void }) {
  const router = useRouter();
  const {
    user,
    demoMode,
    patients,
    patientsLoading,
    patientsWarning,
    selectedPatientId,
    setSelectedPatientId,
  } = useAppState();
  const { preference, setTheme } = useTheme();
  const ThemeIcon = THEME_ICONS[preference];
  const nextTheme = THEME_CYCLE[(THEME_CYCLE.indexOf(preference) + 1) % THEME_CYCLE.length];

  return (
    <header className="relative flex h-[72px] items-center justify-between gap-4 border-b border-border-subtle bg-surface px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-text-primary">
          Welcome back, {user.name}
        </h2>
        <span className="hidden sm:inline">
          <Bot className="h-5 w-5 text-primary" />
        </span>
      </div>
      <div className="flex flex-1 items-center justify-end gap-3">
        <div className="hidden min-w-[220px] sm:block">
          <select
            value={selectedPatientId ?? ""}
            onChange={(event) => setSelectedPatientId(Number(event.target.value))}
            className="h-9 w-full rounded-[14px] border border-border-subtle bg-surface-muted px-3 text-sm text-text-primary"
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
        <div className="hidden rounded-full bg-surface-subtle px-3 py-1.5 text-[11px] font-medium text-text-secondary sm:block">
          {demoMode ? "Demo mode" : "Connected mode"}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Theme: ${THEME_LABELS[preference]}. Switch to ${THEME_LABELS[nextTheme]}`}
          title={`Theme: ${THEME_LABELS[preference]}`}
          onClick={() => setTheme(nextTheme)}
        >
          <ThemeIcon className="h-4 w-4 text-ink-500" />
        </Button>
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
          data-copilot-trigger
          onClick={onOpenCopilot}
        >
          <Bot className="h-4 w-4" />
          Open Copilot
        </Button>
      </div>
      {patientsWarning ? (
        <p className="absolute right-6 top-[72px] hidden text-[11px] text-warning-text lg:block">
          {patientsWarning}
        </p>
      ) : null}
    </header>
  );
}
