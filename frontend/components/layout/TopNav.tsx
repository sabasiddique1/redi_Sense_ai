"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, ChevronDown, FilePlus, Monitor, Moon, Search, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ModeBadge } from "@/components/ui/mode-badge";
import { MrnChip } from "@/components/ui/mrn-chip";
import { cn } from "@/components/ui/cn";
import { useAppState } from "@/hooks/useAppState";
import { useTheme, type ThemePreference } from "@/components/providers/ThemeProvider";

const THEME_CYCLE: ThemePreference[] = ["light", "dark", "system"];
const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;
const THEME_LABELS = { light: "Light", dark: "Dark", system: "System" } as const;

/** Pages that show the patient chip / primary action in the top bar (design page 09). */
const PATIENT_CHIP_PATHS = ["/", "/symptom-triage", "/report-analyzer", "/patient-profile", "/timeline"];
const PRIMARY_ACTION_PATHS = ["/", "/symptom-triage", "/report-analyzer"];

export function TopNav({ onOpenCopilot, pathname }: { onOpenCopilot: () => void; pathname: string }) {
  const router = useRouter();
  const { user, demoMode, patients, patientsLoading, patientsWarning, selectedPatient, selectedPatientId, setSelectedPatientId, pageHeader } = useAppState();
  const { preference, setTheme } = useTheme();
  const ThemeIcon = THEME_ICONS[preference];
  const nextTheme = THEME_CYCLE[(THEME_CYCLE.indexOf(preference) + 1) % THEME_CYCLE.length];
  const [patientOpen, setPatientOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const selectRef = useRef<HTMLSelectElement | null>(null);

  // ⌘K / Ctrl+K jumps to the Knowledge Center search.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        router.push("/knowledge-center");
        window.setTimeout(() => document.querySelector<HTMLInputElement>('input[aria-label="Search evidence"]')?.focus(), 50);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  useEffect(() => {
    if (!patientOpen) return;
    selectRef.current?.focus();
    const onDown = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) setPatientOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPatientOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [patientOpen]);

  const showPatientChip = PATIENT_CHIP_PATHS.includes(pathname);
  const showPrimaryAction = PRIMARY_ACTION_PATHS.includes(pathname);
  const showCopilot = pathname !== "/settings";
  const initials = user.name.replace(/^Dr\.?\s*/i, "").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header className="relative flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border-hairline bg-surface-raised px-4 sm:px-6">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold tracking-[-0.01em] text-ink-900">{pageHeader?.title ?? `Welcome back, ${user.name}`}</p>
        {pageHeader?.context ? <p className="truncate text-xs text-ink-500">{pageHeader.context}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => router.push("/knowledge-center")}
          className="hidden h-8 items-center gap-2 rounded-pill border border-border-hairline bg-surface-sunken px-3 text-xs text-ink-500 hover:text-ink-900 lg:inline-flex"
          aria-label="Search the Knowledge Center (Command K)"
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          Search
          <kbd className="rounded-[3px] border border-border-strong px-1 font-mono text-[10px] text-ink-400">⌘K</kbd>
        </button>
        <button type="button" onClick={() => router.push("/knowledge-center")} className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-ink-500 hover:bg-surface-sunken lg:hidden" aria-label="Search the Knowledge Center">
          <Search className="h-4 w-4" aria-hidden="true" />
        </button>

        <Button variant="ghost" size="icon" aria-label={`Theme: ${THEME_LABELS[preference]}. Switch to ${THEME_LABELS[nextTheme]}`} title={`Theme: ${THEME_LABELS[preference]}`} onClick={() => setTheme(nextTheme)}>
          <ThemeIcon className="h-4 w-4 text-ink-500" aria-hidden="true" />
        </Button>

        {showPatientChip ? (
          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={patientOpen}
              aria-label={selectedPatient ? `Patient: ${selectedPatient.name}. Change patient` : "Choose patient"}
              onClick={() => setPatientOpen((open) => !open)}
              disabled={patientsLoading || patients.length === 0}
              className="inline-flex h-8 max-w-[260px] items-center gap-2 rounded-pill border border-border-hairline bg-surface px-3 hover:border-border-strong disabled:opacity-60"
            >
              {selectedPatient ? (
                <MrnChip name={selectedPatient.name} mrn={selectedPatient.mrn} compact={false} className="text-xs" />
              ) : (
                <span className="text-xs text-ink-500">{patientsLoading ? "Loading patients…" : "No patients available"}</span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
            </button>
            {patientOpen ? (
              <div className="absolute right-0 top-10 z-40 w-72 rounded-lg border border-border-hairline bg-surface-raised p-3 shadow-elevation-2">
                <label className="text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500" htmlFor="patient-select">
                  Patient context
                </label>
                <select
                  id="patient-select"
                  ref={selectRef}
                  value={selectedPatientId ?? ""}
                  onChange={(event) => {
                    setSelectedPatientId(Number(event.target.value));
                    setPatientOpen(false);
                  }}
                  className="mt-2 h-9 w-full rounded-md border border-border-hairline bg-surface px-2 text-sm text-ink-900"
                >
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name} {patient.mrn ? `· MRN ${patient.mrn}` : ""}
                    </option>
                  ))}
                </select>
                {patientsWarning ? <p className="mt-2 text-2xs text-severity-moderate">{patientsWarning}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <ModeBadge mode={demoMode ? "demo" : "real"} className="hidden sm:inline-flex" />

        {showPrimaryAction ? (
          <Button variant="outline" size="sm" className="hidden gap-1.5 sm:inline-flex" onClick={() => router.push("/report-analyzer")}>
            <FilePlus className="h-4 w-4" aria-hidden="true" />
            New report
          </Button>
        ) : null}

        {showCopilot ? (
          <Button variant="primary" size="sm" className="gap-1.5" data-copilot-trigger onClick={onOpenCopilot}>
            <Bot className="h-4 w-4" aria-hidden="true" />
            Copilot
          </Button>
        ) : null}

        <span className={cn("ml-1 hidden h-7 w-7 items-center justify-center rounded-full bg-accent-100 text-2xs font-semibold text-accent-700 sm:inline-flex")} title={`${user.name} · ${user.role}`} aria-label={`${user.name}, ${user.role}`} role="img">
          {initials}
        </span>
      </div>
    </header>
  );
}
