"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { mockPatientProfile } from "@/features/mock-data/patient-profile";
import { apiBaseUrl, apiClient, readStorageWithLegacyFallback } from "@/lib/api";
import type {
  PatientListItem,
  PublicConfigResponse,
  TriageDraft,
  TriageAnalyzeResponse,
} from "@/lib/contracts";


const DEMO_MODE_KEY = "redisense-demo-mode";
const SELECTED_PATIENT_KEY = "redisense-selected-patient";
const TRIAGE_STATE_KEY = "redisense-triage-state";
// Pre-rename keys; read once and migrated by readStorageWithLegacyFallback.
const LEGACY_DEMO_MODE_KEY = "reportiq-demo-mode";
const LEGACY_SELECTED_PATIENT_KEY = "reportiq-selected-patient";
const LEGACY_TRIAGE_STATE_KEY = "reportiq-triage-state";
const SIDEBAR_KEY = "redisense-sidebar-collapsed";
const LEGACY_SIDEBAR_KEY = "reportiq-sidebar-collapsed";

type SavedTriageState = {
  draft: TriageDraft;
  result: TriageAnalyzeResponse | null;
  timelineMessage: string | null;
};

function createEmptyTriageDraft(): TriageDraft {
  return {
    age: "",
    sex: "",
    mainSymptom: "",
    durationValue: "",
    durationUnit: "days",
    severity: "",
    location: "",
    locationDetail: "",
    radiation: [],
    radiationDetail: "",
    associatedSymptoms: [],
    aggravatingFactors: [],
    relievingFactors: [],
    redFlags: [],
    noRedFlags: false,
    relevantHistory: [],
    historyDetail: "",
    additionalDetails: "",
    systolicBp: "",
    diastolicBp: "",
    heartRate: "",
    temperatureC: "",
    spo2: "",
  };
}

const EMPTY_TRIAGE_STATE: SavedTriageState = {
  draft: createEmptyTriageDraft(),
  result: null,
  timelineMessage: null,
};

function triageStateKey(patientId: number | null, demoMode: boolean): string {
  return `${demoMode ? "demo" : "live"}:${patientId ?? "none"}`;
}

function readStoredTriageStates(): Record<string, SavedTriageState> {
  if (typeof window === "undefined") {
    return {};
  }

  const storedValue = readStorageWithLegacyFallback(
    window.localStorage,
    TRIAGE_STATE_KEY,
    LEGACY_TRIAGE_STATE_KEY,
  );
  if (!storedValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(storedValue) as Record<string, Partial<SavedTriageState> & { input?: string }>;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => {
        const legacyInput =
          typeof value?.input === "string" ? value.input : "";
        const nextDraft = {
          ...createEmptyTriageDraft(),
          ...(value?.draft ?? {}),
          additionalDetails:
            value?.draft?.additionalDetails ?? legacyInput,
        };

        return [
          key,
          {
            draft: nextDraft,
            result: value?.result ?? null,
            timelineMessage:
              typeof value?.timelineMessage === "string" ? value.timelineMessage : null,
          },
        ];
      }),
    );
  } catch {
    return {};
  }
}

function readStoredDemoMode(): boolean {
  if (typeof window === "undefined") {
    return initialDemoMode;
  }

  const storedDemoMode = readStorageWithLegacyFallback(
    window.localStorage,
    DEMO_MODE_KEY,
    LEGACY_DEMO_MODE_KEY,
  );
  return storedDemoMode !== null ? storedDemoMode === "true" : initialDemoMode;
}

function readStoredPatientId(): number | null {
  if (typeof window === "undefined") {
    return 1;
  }

  const storedPatientId = readStorageWithLegacyFallback(
    window.localStorage,
    SELECTED_PATIENT_KEY,
    LEGACY_SELECTED_PATIENT_KEY,
  );
  if (!storedPatientId) {
    return 1;
  }

  const parsedPatientId = Number(storedPatientId);
  return Number.isInteger(parsedPatientId) && parsedPatientId > 0
    ? parsedPatientId
    : 1;
}

export type AppUser = {
  name: string;
  role: string;
};

// There is no user/identity endpoint yet (Auth0 is optional and verifies tokens
// only), so both modes present the demo clinician. Swap this for the verified
// identity once a /me route exists.
export const DEMO_USER: AppUser = { name: "Dr. A. Hernandez", role: "Internal Medicine" };

type AppStateContextValue = {
  apiBaseUrl: string;
  user: AppUser;
  /** True once persisted demo/patient/triage state has been read on the client. */
  hydrated: boolean;
  demoMode: boolean;
  setDemoMode: (value: boolean) => void;
  patients: PatientListItem[];
  selectedPatientId: number | null;
  setSelectedPatientId: (value: number | null) => void;
  selectedPatient: PatientListItem | null;
  patientsLoading: boolean;
  patientsWarning: string | null;
  publicConfig: PublicConfigResponse | null;
  activityVersion: number;
  lastActivityMessage: string | null;
  triageDraft: TriageDraft;
  setTriageDraft: (value: TriageDraft) => void;
  triageResult: TriageAnalyzeResponse | null;
  setTriageResult: (value: TriageAnalyzeResponse | null) => void;
  triageTimelineMessage: string | null;
  setTriageTimelineMessage: (value: string | null) => void;
  notifyPatientActivity: (message: string, patientId?: number | null) => void;
  /** Copilot drawer is global (opened from the top bar and from evidence cards). */
  copilotOpen: boolean;
  copilotPrefill: string | null;
  openCopilot: (prefill?: string) => void;
  closeCopilot: () => void;
  clearCopilotPrefill: () => void;
  /** Page title + context rendered by the top bar (pages register via <PageHeader>). */
  pageHeader: { title: string; context?: string } | null;
  setPageHeader: (header: { title: string; context?: string } | null) => void;
  /** Manual sidebar collapse, persisted per browser. */
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

function getDemoPatients(): PatientListItem[] {
  return [
    {
      id: 1,
      mrn: mockPatientProfile.mrn,
      name: mockPatientProfile.name,
      dob: mockPatientProfile.dob,
      gender: mockPatientProfile.gender,
    },
  ];
}

const initialDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export function AppStateProvider({ children }: { children: ReactNode }) {
  // Server and first client render use defaults; localStorage is read in the
  // hydration effect below so the two renders never disagree.
  const [hydrated, setHydrated] = useState(false);
  const [demoMode, setDemoModeState] = useState(initialDemoMode);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [selectedPatientId, setSelectedPatientIdState] = useState<number | null>(1);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientsWarning, setPatientsWarning] = useState<string | null>(null);
  const [publicConfig, setPublicConfig] = useState<PublicConfigResponse | null>(null);
  const [activityVersion, setActivityVersion] = useState(0);
  const [lastActivityMessage, setLastActivityMessage] = useState<string | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotPrefill, setCopilotPrefill] = useState<string | null>(null);
  const [pageHeader, setPageHeader] = useState<{ title: string; context?: string } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [triageStates, setTriageStates] = useState<Record<string, SavedTriageState>>({});

  useEffect(() => {
    setDemoModeState(readStoredDemoMode());
    setSelectedPatientIdState(readStoredPatientId());
    setTriageStates(readStoredTriageStates());
    setSidebarCollapsedState(readStorageWithLegacyFallback(window.localStorage, SIDEBAR_KEY, LEGACY_SIDEBAR_KEY) === "true");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    window.localStorage.setItem(DEMO_MODE_KEY, String(demoMode));
  }, [demoMode, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (selectedPatientId == null) {
      window.localStorage.removeItem(SELECTED_PATIENT_KEY);
      return;
    }

    window.localStorage.setItem(SELECTED_PATIENT_KEY, String(selectedPatientId));
  }, [selectedPatientId, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(TRIAGE_STATE_KEY, JSON.stringify(triageStates));
  }, [triageStates, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    let cancelled = false;

    const loadPatients = async () => {
      setPatientsLoading(true);
      try {
        const result = await apiClient.fetchPatients({
          demoMode,
          fallback: getDemoPatients,
          fallbackMessage: "Demo mode is enabled. Using demo patient context.",
        });

        if (cancelled) {
          return;
        }

        setPatients(result.data);
        setPatientsWarning(result.warning ?? null);
        setSelectedPatientIdState((current) => {
          if (current && result.data.some((patient) => patient.id === current)) {
            return current;
          }
          if (result.data.some((patient) => patient.id === 1)) {
            return 1;
          }
          return result.data[0]?.id ?? null;
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setPatients([]);
        setPatientsWarning(
          error instanceof Error
            ? error.message
            : "Unable to load patients from the backend.",
        );
        setSelectedPatientIdState(null);
      } finally {
        if (!cancelled) {
          setPatientsLoading(false);
        }
      }
    };

    void loadPatients();

    return () => {
      cancelled = true;
    };
  }, [demoMode, hydrated]);

  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      try {
        const config = await apiClient.fetchPublicConfig();
        if (!cancelled) {
          setPublicConfig(config);
        }
      } catch {
        if (!cancelled) {
          setPublicConfig(null);
        }
      }
    };

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPatient =
    patients.find((patient) => patient.id === selectedPatientId) ?? null;
  const currentTriageKey = triageStateKey(selectedPatientId, demoMode);
  const currentTriageState = triageStates[currentTriageKey] ?? EMPTY_TRIAGE_STATE;

  const updateCurrentTriageState = (
    updater: (state: SavedTriageState) => SavedTriageState,
  ) => {
    setTriageStates((current) => ({
      ...current,
      [currentTriageKey]: updater(current[currentTriageKey] ?? EMPTY_TRIAGE_STATE),
    }));
  };

  const setTriageDraft = (value: TriageDraft) => {
    updateCurrentTriageState((state) => ({ ...state, draft: value }));
  };

  const setTriageResult = (value: TriageAnalyzeResponse | null) => {
    updateCurrentTriageState((state) => ({ ...state, result: value }));
  };

  const setTriageTimelineMessage = (value: string | null) => {
    updateCurrentTriageState((state) => ({ ...state, timelineMessage: value }));
  };

  const setSidebarCollapsed = (collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    try {
      window.localStorage.setItem(SIDEBAR_KEY, String(collapsed));
    } catch {
      // storage unavailable
    }
  };

  const openCopilot = (prefill?: string) => {
    if (prefill) setCopilotPrefill(prefill);
    setCopilotOpen(true);
  };
  const closeCopilot = () => setCopilotOpen(false);
  const clearCopilotPrefill = () => setCopilotPrefill(null);

  const notifyPatientActivity = (message: string, patientId?: number | null) => {
    setLastActivityMessage(message);
    setActivityVersion((current) => current + 1);
    if (patientId != null) {
      setSelectedPatientIdState((current) => current ?? patientId);
    }
  };

  return (
    <AppStateContext.Provider
      value={{
        apiBaseUrl,
        user: DEMO_USER,
        hydrated,
        demoMode,
        setDemoMode: setDemoModeState,
        patients,
        selectedPatientId,
        setSelectedPatientId: setSelectedPatientIdState,
        selectedPatient,
        patientsLoading,
        patientsWarning,
        publicConfig,
        activityVersion,
        lastActivityMessage,
        triageDraft: currentTriageState.draft,
        setTriageDraft,
        triageResult: currentTriageState.result,
        setTriageResult,
        triageTimelineMessage: currentTriageState.timelineMessage,
        setTriageTimelineMessage,
        notifyPatientActivity,
        copilotOpen,
        copilotPrefill,
        openCopilot,
        closeCopilot,
        clearCopilotPrefill,
        pageHeader,
        setPageHeader,
        sidebarCollapsed,
        setSidebarCollapsed,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return context;
}
