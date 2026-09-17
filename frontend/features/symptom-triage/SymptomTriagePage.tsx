"use client";

import { useEffect, useState } from "react";
import { Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/hooks/useAppState";
import { apiClient, ApiError } from "@/lib/api";
import type {
  AiMode,
  FallbackReason,
  ResultMode,
  TriageAnalyzeResponse,
  TriageAssociatedSymptom,
  TriageCareLevel,
  TriageDraft,
  TriageDurationUnit,
  TriageFactor,
  TriageHistoryItem,
  TriageLocation,
  TriageRadiation,
  TriageRedFlag,
  TriageStructuredInput,
  TriageSex,
} from "@/lib/contracts";
import { mockTriageResult } from "../mock-data/symptom-triage";
import { PageHeader } from "../shared/PageHeader";
import { EmptyState, SkeletonCard } from "../shared/PageStates";
import { DisclaimerBar } from "@/components/ui/disclaimer-bar";
import { HBarList } from "@/components/charts/HBarList";
import { assessVitals, type VitalReading } from "./vitals";
import { mockTriageContributors } from "../mock-data/symptom-triage";
import { EvidenceChips, VerdictBlock } from "../shared/VerdictBlock";
import { isEscalationLevel, normalizeRiskLevel, riskClasses } from "../shared/risk";


type TriageResult = {
  riskLevel: string | null;
  careLevel: TriageCareLevel | null;
  summary: string;
  reasoning: string[];
  differential: string[];
  redFlags: string[];
  recommendedAction: string;
  actionDetail: string;
  fallbackReason: FallbackReason | null;
  renderMode: ResultMode;
  aiMode: AiMode;
  disclaimer: string;
  invalidInput: boolean;
  validationMessage: string | null;
  timelineEventId: number | null;
};

type ToggleOption<T extends string> = {
  value: T;
  label: string;
};

const SEX_OPTIONS: ToggleOption<TriageSex>[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
];

const DURATION_UNIT_OPTIONS: ToggleOption<TriageDurationUnit>[] = [
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
];

const LOCATION_OPTIONS: ToggleOption<TriageLocation>[] = [
  { value: "back", label: "Back" },
  { value: "neck", label: "Neck" },
  { value: "chest", label: "Chest" },
  { value: "abdomen", label: "Abdomen" },
  { value: "head", label: "Head" },
  { value: "face_mouth", label: "Face/mouth" },
  { value: "throat", label: "Throat" },
  { value: "pelvis_flank", label: "Pelvis/flank" },
  { value: "urinary_genital", label: "Urinary/genital" },
  { value: "arm_leg", label: "Arm/leg" },
  { value: "joint", label: "Joint" },
  { value: "skin", label: "Skin/soft tissue" },
  { value: "generalized", label: "Generalized" },
  { value: "other", label: "Other" },
];

const RADIATION_OPTIONS: ToggleOption<TriageRadiation>[] = [
  { value: "none", label: "None" },
  { value: "neck", label: "Neck" },
  { value: "arm", label: "Arm" },
  { value: "jaw", label: "Jaw" },
  { value: "shoulder", label: "Shoulder" },
  { value: "leg", label: "Leg" },
  { value: "groin", label: "Groin" },
  { value: "abdomen", label: "Abdomen" },
  { value: "other", label: "Other" },
];

const ASSOCIATED_SYMPTOM_OPTIONS: ToggleOption<TriageAssociatedSymptom>[] = [
  { value: "numbness_tingling", label: "Numbness/tingling" },
  { value: "weakness", label: "Weakness" },
  { value: "shortness_of_breath", label: "Breathing trouble" },
  { value: "chest_pressure", label: "Chest pressure" },
  { value: "fever", label: "Fever" },
  { value: "chills", label: "Chills" },
  { value: "nausea_vomiting", label: "Nausea/vomiting" },
  { value: "cough", label: "Cough" },
  { value: "sore_throat", label: "Sore throat" },
  { value: "runny_nose", label: "Runny nose" },
  { value: "diarrhea", label: "Diarrhea" },
  { value: "urinary_symptoms", label: "Urinary symptoms" },
  { value: "weight_loss", label: "Weight loss" },
  { value: "headache", label: "Headache" },
  { value: "dizziness", label: "Dizziness" },
  { value: "palpitations", label: "Palpitations" },
  { value: "fatigue", label: "Fatigue" },
  { value: "rash", label: "Rash" },
  { value: "swelling", label: "Swelling" },
  { value: "vision_change", label: "Vision change" },
  { value: "confusion", label: "Confusion" },
];

const AGGRAVATING_FACTOR_OPTIONS: ToggleOption<TriageFactor>[] = [
  { value: "movement", label: "Movement" },
  { value: "exertion", label: "Exertion" },
  { value: "sitting", label: "Sitting" },
  { value: "standing", label: "Standing" },
  { value: "walking", label: "Walking" },
  { value: "lifting", label: "Lifting" },
  { value: "deep_breathing", label: "Deep breathing" },
  { value: "coughing", label: "Coughing" },
  { value: "eating", label: "Eating" },
  { value: "swallowing", label: "Swallowing" },
  { value: "urination", label: "Urination" },
  { value: "stress", label: "Stress" },
  { value: "lying_flat", label: "Lying flat" },
];

const RELIEVING_FACTOR_OPTIONS: ToggleOption<TriageFactor>[] = [
  { value: "rest", label: "Rest" },
  { value: "movement", label: "Movement" },
  { value: "stretching", label: "Stretching" },
  { value: "heat_ice", label: "Heat/ice" },
  { value: "otc_pain_meds", label: "OTC pain meds" },
  { value: "position_change", label: "Position change" },
  { value: "hydration", label: "Hydration/fluids" },
  { value: "inhaler", label: "Inhaler" },
  { value: "antacid", label: "Antacid" },
  { value: "nothing", label: "Nothing helps" },
];

const RED_FLAG_OPTIONS: ToggleOption<TriageRedFlag>[] = [
  { value: "fainting", label: "Fainting or near-fainting" },
  { value: "severe_breathing_trouble", label: "Severe breathing trouble" },
  { value: "new_confusion", label: "New confusion" },
  { value: "seizure_or_worst_headache", label: "Seizure or worst headache" },
  { value: "speech_or_facial_change", label: "Speech/facial neurologic change" },
  { value: "new_weakness_or_numbness", label: "New weakness or numbness" },
  { value: "bowel_bladder_change", label: "Loss of bowel/bladder control" },
  { value: "saddle_anesthesia", label: "Saddle numbness" },
  { value: "recent_major_trauma", label: "Recent major trauma" },
  { value: "unable_to_walk", label: "Unable to walk or stand" },
  { value: "persistent_vomiting", label: "Persistent vomiting" },
  { value: "high_fever", label: "High fever" },
  { value: "severe_allergic_swelling", label: "Severe swelling/allergic reaction" },
  { value: "heavy_bleeding", label: "Heavy bleeding" },
];

const HISTORY_OPTIONS: ToggleOption<TriageHistoryItem>[] = [
  { value: "chronic_back_pain", label: "Chronic back pain history" },
  { value: "recent_strain_or_lifting", label: "Recent strain/lifting" },
  { value: "heart_disease", label: "Heart disease" },
  { value: "hypertension", label: "Hypertension" },
  { value: "blood_clot_history", label: "Blood clot history" },
  { value: "asthma_lung_disease", label: "Asthma/lung disease" },
  { value: "cancer_history", label: "Cancer history" },
  { value: "osteoporosis", label: "Osteoporosis" },
  { value: "kidney_stone_history", label: "Kidney stone history" },
  { value: "pregnancy", label: "Pregnancy" },
  { value: "diabetes", label: "Diabetes" },
  { value: "immunocompromised", label: "Immunocompromised" },
  { value: "recent_surgery_or_immobility", label: "Recent surgery/immobility" },
  { value: "stroke_or_seizure_history", label: "Stroke/seizure history" },
  { value: "smoker", label: "Smoker" },
];

function parseOptionalInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalFloat(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function humanizeCode(value: string): string {
  return value.replace(/_/g, " ");
}

function humanizeList(values: string[]): string {
  return values.map(humanizeCode).join(", ");
}

function buildStructuredInput(draft: TriageDraft): TriageStructuredInput {
  return {
    age: parseOptionalInteger(draft.age),
    sex: draft.sex || null,
    main_symptom: draft.mainSymptom.trim(),
    duration_value: parseOptionalInteger(draft.durationValue),
    duration_unit: draft.durationValue ? draft.durationUnit : null,
    severity: parseOptionalInteger(draft.severity),
    location: draft.location || null,
    location_detail: draft.locationDetail.trim() || null,
    radiation: draft.radiation,
    radiation_detail: draft.radiationDetail.trim() || null,
    associated_symptoms: draft.associatedSymptoms,
    aggravating_factors: draft.aggravatingFactors,
    relieving_factors: draft.relievingFactors,
    red_flags: draft.noRedFlags ? [] : draft.redFlags,
    no_red_flags: draft.noRedFlags,
    relevant_history: draft.relevantHistory,
    history_detail: draft.historyDetail.trim() || null,
    additional_details: draft.additionalDetails.trim() || null,
    vitals: {
      systolic_bp: parseOptionalInteger(draft.systolicBp),
      diastolic_bp: parseOptionalInteger(draft.diastolicBp),
      heart_rate: parseOptionalInteger(draft.heartRate),
      temperature_c: parseOptionalFloat(draft.temperatureC),
      spo2: parseOptionalInteger(draft.spo2),
    },
  };
}

function buildSymptomsText(draft: TriageDraft): string {
  const parts: string[] = [];

  if (draft.age.trim()) {
    parts.push(`${draft.age.trim()}yo`);
  }
  if (draft.sex) {
    parts.push(draft.sex);
  }
  if (draft.mainSymptom.trim()) {
    parts.push(`main symptom ${draft.mainSymptom.trim()}`);
  }
  if (draft.durationValue.trim()) {
    parts.push(`duration ${draft.durationValue.trim()} ${draft.durationUnit}`);
  }
  if (draft.severity.trim()) {
    parts.push(`severity ${draft.severity.trim()}/10`);
  }
  if (draft.location) {
    parts.push(`location ${draft.location.replace(/_/g, " ")}`);
  }
  if (draft.locationDetail.trim()) {
    parts.push(`location detail ${draft.locationDetail.trim()}`);
  }
  if (draft.radiation.length > 0 && !draft.radiation.includes("none")) {
    parts.push(`radiation ${humanizeList(draft.radiation)}`);
  }
  if (draft.associatedSymptoms.length > 0) {
    parts.push(`associated symptoms ${humanizeList(draft.associatedSymptoms)}`);
  }
  if (draft.aggravatingFactors.length > 0) {
    parts.push(`worse with ${humanizeList(draft.aggravatingFactors)}`);
  }
  if (draft.relievingFactors.length > 0) {
    parts.push(`better with ${humanizeList(draft.relievingFactors)}`);
  }
  if (draft.noRedFlags) {
    parts.push("no red flags reported");
  } else if (draft.redFlags.length > 0) {
    parts.push(`red flags ${humanizeList(draft.redFlags)}`);
  }
  if (draft.relevantHistory.length > 0) {
    parts.push(`relevant history ${humanizeList(draft.relevantHistory)}`);
  }
  if (draft.historyDetail.trim()) {
    parts.push(`history detail ${draft.historyDetail.trim()}`);
  }
  if (draft.additionalDetails.trim()) {
    parts.push(`additional details ${draft.additionalDetails.trim()}`);
  }
  if (draft.systolicBp.trim() && draft.diastolicBp.trim()) {
    parts.push(`BP ${draft.systolicBp.trim()}/${draft.diastolicBp.trim()}`);
  }
  if (draft.heartRate.trim()) {
    parts.push(`HR ${draft.heartRate.trim()}`);
  }
  if (draft.temperatureC.trim()) {
    parts.push(`Temp ${draft.temperatureC.trim()}C`);
  }
  if (draft.spo2.trim()) {
    parts.push(`SpO2 ${draft.spo2.trim()}%`);
  }

  return parts.join(". ");
}

function fallbackCareLevel(riskLevel: string | null): TriageCareLevel | null {
  if (riskLevel === "Critical") return "Emergency";
  if (riskLevel === "High") return "Urgent";
  if (riskLevel === "Moderate") return "Routine";
  if (riskLevel === "Low") return "Self-care";
  return null;
}

function buildDemoTriageResponse(patientId: number | null): TriageAnalyzeResponse {
  return {
    session_id: 0,
    patient_id: patientId,
    risk_level: mockTriageResult.riskLevel,
    care_level: "Emergency",
    red_flags: mockTriageResult.redFlags,
    recommended_action: mockTriageResult.recommendedAction,
    summary: mockTriageResult.summary,
    differential: mockTriageResult.differential,
    reasoning: [
      "Demo mode is showing a sample high-risk chest-pain scenario.",
      "Switch to connected mode for rule-based analysis of the entered structured facts.",
    ],
    disclaimer:
      "Clinical decision support only. Verify findings with licensed clinical judgment.",
    mode: "demo",
    ai_mode: null,
    invalid_input: false,
    validation_message: null,
    timeline_event_id: null,
    created_at: new Date().toISOString(),
  };
}

function mapTriageToView(payload: TriageAnalyzeResponse): TriageResult {
  return {
    riskLevel: payload.risk_level,
    careLevel: payload.care_level ?? fallbackCareLevel(payload.risk_level),
    summary: payload.summary,
    reasoning: payload.reasoning ?? [],
    differential: payload.differential,
    redFlags: payload.red_flags,
    recommendedAction: payload.recommended_action,
    actionDetail: payload.validation_message ?? payload.disclaimer,
    fallbackReason: payload.fallback_reason ?? null,
    renderMode: payload.mode,
    aiMode: payload.ai_mode,
    disclaimer: payload.disclaimer,
    invalidInput: payload.invalid_input,
    validationMessage: payload.validation_message,
    timelineEventId: payload.timeline_event_id,
  };
}

function SectionLabel({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium text-text-body">{title}</p>
      {description ? (
        <p className="text-[11px] text-text-secondary">{description}</p>
      ) : null}
    </div>
  );
}

function ToggleGroup<T extends string>({
  options,
  selectedValues,
  onToggle,
}: {
  options: ToggleOption<T>[];
  selectedValues: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = selectedValues.includes(option.value);
        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={selected ? "primary" : "outline"}
            className={selected ? "" : "bg-surface"}
            onClick={() => onToggle(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

function SingleSelectGroup<T extends string>({
  options,
  selectedValue,
  onSelect,
}: {
  options: ToggleOption<T>[];
  selectedValue: T | "";
  onSelect: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = selectedValue === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={selected ? "primary" : "outline"}
            className={selected ? "" : "bg-surface"}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

export function SymptomTriagePage() {
  const {
    demoMode,
    selectedPatient,
    selectedPatientId,
    notifyPatientActivity,
    triageDraft,
    setTriageDraft,
    triageResult,
    setTriageResult,
    triageTimelineMessage,
    setTriageTimelineMessage,
  } = useAppState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const result = triageResult ? mapTriageToView(triageResult) : null;

  useEffect(() => {
    setError(null);
  }, [demoMode, selectedPatientId]);

  const updateDraft = (patch: Partial<TriageDraft>) => {
    setTriageDraft({
      ...triageDraft,
      ...patch,
    });
  };

  const toggleMultiValue = <T extends string,>(key: keyof TriageDraft, value: T) => {
    const currentValues = triageDraft[key] as T[];
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((item) => item !== value)
      : [...currentValues, value];
    updateDraft({ [key]: nextValues } as Partial<TriageDraft>);
  };

  const toggleRadiation = (value: TriageRadiation) => {
    if (value === "none") {
      updateDraft({ radiation: ["none"], radiationDetail: "" });
      return;
    }

    const currentValues = triageDraft.radiation.filter((item) => item !== "none");
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((item) => item !== value)
      : [...currentValues, value];
    updateDraft({ radiation: nextValues });
  };

  const toggleRedFlag = (value: TriageRedFlag) => {
    const nextValues = triageDraft.redFlags.includes(value)
      ? triageDraft.redFlags.filter((item) => item !== value)
      : [...triageDraft.redFlags, value];
    updateDraft({
      redFlags: nextValues,
      noRedFlags: false,
    });
  };

  const handleAnalyze = async () => {
    if (!triageDraft.mainSymptom.trim()) {
      setError("Enter the main symptom before analyzing triage.");
      setTriageResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    setTriageTimelineMessage(null);

    const structuredInput = buildStructuredInput(triageDraft);

    try {
      const apiResult = await apiClient.analyzeTriage(
        {
          symptoms: buildSymptomsText(triageDraft),
          structured_input: structuredInput,
          patient_id: selectedPatientId,
        },
        {
          demoMode,
          fallback: () => buildDemoTriageResponse(selectedPatientId),
          fallbackMessage: "Demo mode is enabled. Showing demo triage output.",
        },
      );

      const nextResult = mapTriageToView(apiResult.data);
      setTriageResult(apiResult.data);
      setError(apiResult.warning ?? null);

      if (
        apiResult.mode !== "demo" &&
        nextResult.timelineEventId &&
        selectedPatientId
      ) {
        const message = "Triage saved and patient timeline updated.";
        setTriageTimelineMessage(message);
        notifyPatientActivity(message, selectedPatientId);
      } else if (apiResult.mode === "demo") {
        setTriageTimelineMessage("Demo mode result only. No timeline event was created.");
      }
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiError
          ? caughtError.message
          : "Unable to analyze triage input right now.";
      setTriageResult(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const vitals = assessVitals(triageDraft);
  const severityValue = Number(triageDraft.severity) || 0;
  const resultLevel = result ? normalizeRiskLevel(result.riskLevel) : null;
  // Demo-only: the triage engine does not expose contributor weights.
  // TODO(backend): TriageAnalyzeResponse.contributors [{label, weight}] from the rule engine.
  const contributors = result?.renderMode === "demo" ? mockTriageContributors : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Symptom Triage"
        subtitle="Enter structured symptom details for safer triage, explicit red-flag detection, and clearer recommendations."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card-surface p-5" aria-labelledby="triage-intake-title">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="triage-intake-title" className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <Stethoscope className="h-4 w-4 text-accent-600" aria-hidden="true" />
                Intake
              </h2>
              <p className="mt-0.5 text-2xs text-ink-500">Structured facts drive triage. AI is used only to explain the grounded result.</p>
            </div>
            <p className="text-right text-2xs text-ink-500">
              {selectedPatient ? (
                <>
                  Linked patient
                  <br />
                  <span className="font-semibold text-ink-900">{selectedPatient.name}</span>
                </>
              ) : (
                "No connected patient context"
              )}
            </p>
          </div>

          <div className="mt-5 space-y-5">
            <div className="space-y-2">
              <SectionLabel title="Main symptom" description="Use the primary complaint, for example sore throat, low back pain, chest tightness, vomiting, or dizziness." />
              <Input value={triageDraft.mainSymptom} onChange={(event) => updateDraft({ mainSymptom: event.target.value })} placeholder="e.g., sharp chest pain, left side" />
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.4fr]">
              <div className="space-y-2">
                <SectionLabel title="Age" />
                <Input type="number" min="0" max="120" value={triageDraft.age} onChange={(event) => updateDraft({ age: event.target.value })} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <SectionLabel title="Sex" />
                <SingleSelectGroup options={SEX_OPTIONS} selectedValue={triageDraft.sex} onSelect={(value) => updateDraft({ sex: triageDraft.sex === value ? "" : value })} />
              </div>
              <div className="space-y-2">
                <SectionLabel title="Duration" />
                <div className="flex gap-2">
                  <Input type="number" min="0" value={triageDraft.durationValue} onChange={(event) => updateDraft({ durationValue: event.target.value })} placeholder="45" className="w-24" />
                  <select
                    aria-label="Duration unit"
                    value={triageDraft.durationUnit}
                    onChange={(event) => updateDraft({ durationUnit: event.target.value as TriageDurationUnit })}
                    className="h-10 flex-1 rounded-md border border-border-hairline bg-surface px-2 text-sm text-ink-900"
                  >
                    {DURATION_UNIT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <SectionLabel title="Severity" />
                <span className="font-mono text-xs text-ink-700 rs-tabular">{triageDraft.severity ? `${severityValue} / 10` : "not rated"}</span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={severityValue}
                aria-label="Severity, 0 none to 10 worst ever"
                aria-valuetext={triageDraft.severity ? `${severityValue} of 10` : "not rated"}
                onChange={(event) => updateDraft({ severity: event.target.value })}
                className="w-full accent-accent-600"
              />
              <div className="flex justify-between text-2xs text-ink-400" aria-hidden="true">
                <span>0 none</span>
                <span>10 worst ever</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <SectionLabel title="Location" />
                <SingleSelectGroup options={LOCATION_OPTIONS} selectedValue={triageDraft.location} onSelect={(value) => updateDraft({ location: triageDraft.location === value ? "" : value })} />
                <Input value={triageDraft.locationDetail} onChange={(event) => updateDraft({ locationDetail: event.target.value })} placeholder="Detail, e.g. substernal, left chest" />
              </div>
              <div className="space-y-2">
                <SectionLabel title="Radiation" description="Only if the symptom spreads to another area." />
                <ToggleGroup options={RADIATION_OPTIONS} selectedValues={triageDraft.radiation} onToggle={toggleRadiation} />
                {triageDraft.radiation.includes("other") ? (
                  <Input value={triageDraft.radiationDetail} onChange={(event) => updateDraft({ radiationDetail: event.target.value })} placeholder="Describe where it radiates" />
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <SectionLabel title="Associated symptoms" description="Add only symptoms that are actually present." />
              <ToggleGroup options={ASSOCIATED_SYMPTOM_OPTIONS} selectedValues={triageDraft.associatedSymptoms} onToggle={(value) => toggleMultiValue("associatedSymptoms", value)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <SectionLabel title="Aggravating factors" />
                <ToggleGroup options={AGGRAVATING_FACTOR_OPTIONS} selectedValues={triageDraft.aggravatingFactors} onToggle={(value) => toggleMultiValue("aggravatingFactors", value)} />
              </div>
              <div className="space-y-2">
                <SectionLabel title="Relieving factors" />
                <ToggleGroup options={RELIEVING_FACTOR_OPTIONS} selectedValues={triageDraft.relievingFactors} onToggle={(value) => toggleMultiValue("relievingFactors", value)} />
              </div>
            </div>

            <fieldset className="space-y-2 rounded-md border border-severity-critical/30 bg-severity-critical-bg p-3">
              <legend className="px-1 text-2xs font-semibold uppercase tracking-[0.05em] text-severity-critical">Explicit red flags</legend>
              <p className="text-2xs text-ink-500">Use only true warning signs. Symptom location such as back pain should not be entered here.</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {RED_FLAG_OPTIONS.map((option) => {
                  const checked = triageDraft.redFlags.includes(option.value);
                  return (
                    <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-xs text-ink-900 hover:bg-surface/60">
                      <input type="checkbox" checked={checked} onChange={() => toggleRedFlag(option.value)} className="h-3.5 w-3.5 accent-severity-critical" />
                      {option.label}
                    </label>
                  );
                })}
              </div>
              <label className="flex cursor-pointer items-center gap-2 border-t border-severity-critical/20 pt-2 text-xs text-ink-700">
                <input type="checkbox" checked={triageDraft.noRedFlags} onChange={() => updateDraft({ noRedFlags: !triageDraft.noRedFlags, redFlags: [] })} className="h-3.5 w-3.5 accent-accent-600" />
                None reported
              </label>
            </fieldset>

            <div className="space-y-2">
              <SectionLabel title="Relevant history" description="Include broad medical context that meaningfully changes risk." />
              <ToggleGroup options={HISTORY_OPTIONS} selectedValues={triageDraft.relevantHistory} onToggle={(value) => toggleMultiValue("relevantHistory", value)} />
              <Input value={triageDraft.historyDetail} onChange={(event) => updateDraft({ historyDetail: event.target.value })} placeholder="e.g. Hypertension, hyperlipidemia. Former smoker (quit 2019)." />
            </div>

            <div className="space-y-2">
              <SectionLabel title="Additional details" />
              <Textarea rows={3} value={triageDraft.additionalDetails} onChange={(event) => updateDraft({ additionalDetails: event.target.value })} placeholder="Optional — free text" />
            </div>

            <fieldset className="rounded-md border border-border-hairline bg-surface-sunken p-3">
              <legend className="px-1 text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">Vitals</legend>
              <p className="text-2xs text-ink-500">Optional. Abnormal vitals can increase urgency even when no explicit red flags are checked.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <SectionLabel title="BP (sys/dia)" />
                  <div className="flex items-center gap-1">
                    <Input type="number" aria-label="Systolic BP" value={triageDraft.systolicBp} onChange={(event) => updateDraft({ systolicBp: event.target.value })} placeholder="152" className="font-mono" />
                    <span className="text-ink-400">/</span>
                    <Input type="number" aria-label="Diastolic BP" value={triageDraft.diastolicBp} onChange={(event) => updateDraft({ diastolicBp: event.target.value })} placeholder="96" className="font-mono" />
                  </div>
                  <VitalNote reading={vitals[0]} />
                </div>
                <div className="space-y-1">
                  <SectionLabel title="Heart rate" />
                  <Input type="number" aria-label="Heart rate" value={triageDraft.heartRate} onChange={(event) => updateDraft({ heartRate: event.target.value })} placeholder="104" className="font-mono" />
                  <VitalNote reading={vitals[1]} />
                </div>
                <div className="space-y-1">
                  <SectionLabel title="Temp (°C)" />
                  <Input type="number" step="0.1" aria-label="Temperature in Celsius" value={triageDraft.temperatureC} onChange={(event) => updateDraft({ temperatureC: event.target.value })} placeholder="37.1" className="font-mono" />
                  <VitalNote reading={vitals[2]} />
                </div>
                <div className="space-y-1">
                  <SectionLabel title="SpO2 (%)" />
                  <Input type="number" aria-label="Oxygen saturation" value={triageDraft.spo2} onChange={(event) => updateDraft({ spo2: event.target.value })} placeholder="94" className="font-mono" />
                  <VitalNote reading={vitals[3]} />
                </div>
              </div>
            </fieldset>

            <p className="text-2xs text-ink-500">
              The urgency level is determined by rule-based logic first. AI is allowed to explain the result, but it cannot invent red flags or override the final urgency.
            </p>

            <Button onClick={handleAnalyze} className="w-full gap-2" disabled={loading} loading={loading}>
              <Stethoscope className="h-4 w-4" aria-hidden="true" />
              {loading ? "Running triage…" : "Run triage"}
            </Button>
            {triageTimelineMessage ? <p className="text-2xs text-accent-700">{triageTimelineMessage}</p> : null}
            {error ? <p className="text-2xs text-severity-critical" role="alert">{error}</p> : null}
          </div>
        </section>

        <div className="space-y-4">
          {loading && !result ? (
            <div className="space-y-4" aria-busy="true">
              <SkeletonCard lines={2} />
              <SkeletonCard lines={4} />
              <SkeletonCard lines={3} />
            </div>
          ) : result ? (
            <>
              <VerdictBlock
                severityLabel="Risk level"
                severity={resultLevel}
                secondary={result.careLevel ? `Care level: ${result.careLevel}` : null}
                confidence={result.renderMode === "demo" ? 86 : null}
                confidenceNote={result.renderMode === "demo" ? "Demo score for the sample scenario." : "Urgency is rule-based and is not scored as a probability."}
                escalate={!result.invalidInput && (isEscalationLevel(resultLevel) || result.redFlags.length > 0)}
                escalationText={
                  result.invalidInput
                    ? "Input needs correction before a verdict can be issued."
                    : isEscalationLevel(resultLevel)
                      ? "Escalate to attending"
                      : "No explicit red flags were reported."
                }
                redFlags={result.invalidInput ? [] : result.redFlags}
                basis={result.aiMode ? `Rule-based urgency · AI explanation (${result.aiMode})` : "Rule-based urgency"}
                mode={result.renderMode}
              />

              {result.invalidInput ? (
                <div className="rounded-md border border-severity-moderate/30 bg-severity-moderate-bg px-3 py-3 text-xs text-severity-moderate">{result.validationMessage}</div>
              ) : null}

              {!result.invalidInput ? (
                <section className="card-surface p-5" aria-labelledby="triage-contributors-title">
                  <h2 id="triage-contributors-title" className="text-sm font-semibold text-ink-900">Risk contributors</h2>
                  <p className="mt-0.5 text-2xs text-ink-500">Relative weight of inputs that drove this score</p>
                  <div className="mt-3">
                    {contributors ? (
                      <HBarList items={contributors} emphasis="High" title="Risk contributors" />
                    ) : (
                      <p className="rounded-md border border-dashed border-border-strong px-3 py-3 text-2xs text-ink-500">
                        Not available — needs contributor weights from the triage engine. Rule-based red flags are listed in the verdict above.
                      </p>
                    )}
                  </div>
                </section>
              ) : null}

              {!result.invalidInput ? (
                <section className="card-surface p-5" aria-labelledby="triage-recs-title">
                  <h2 id="triage-recs-title" className="text-sm font-semibold text-ink-900">Recommendations</h2>
                  <div className={`mt-3 rounded-md border-l-4 p-4 ${riskClasses(resultLevel).rail} ${riskClasses(resultLevel).soft}`}>
                    <p className="text-sm font-semibold text-ink-900">{result.recommendedAction}</p>
                    <p className="mt-1 text-xs text-ink-700">{result.actionDetail}</p>
                  </div>
                  {result.reasoning.length > 0 ? (
                    <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs text-ink-700">
                      {result.reasoning.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ol>
                  ) : null}
                </section>
              ) : null}

              <section className="card-surface p-5" aria-labelledby="triage-reasoning-title">
                <h2 id="triage-reasoning-title" className="text-sm font-semibold text-ink-900">Reasoning</h2>
                <p className="mt-2 text-xs leading-relaxed text-ink-700">{result.summary}</p>
                {result.fallbackReason ? <p className="mt-2 text-2xs text-ink-500">Fallback reason: {result.fallbackReason}</p> : null}
                {!result.invalidInput && result.differential.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {result.differential.map((item) => (
                      <span key={item} className="rounded-pill bg-accent-050 px-2.5 py-0.5 text-2xs font-medium text-accent-700">{item}</span>
                    ))}
                  </div>
                ) : null}
              </section>

              {!result.invalidInput && result.differential.length > 0 ? (
                <section className="card-surface p-5" aria-labelledby="triage-citations-title">
                  <h2 id="triage-citations-title" className="text-sm font-semibold text-ink-900">Citations</h2>
                  <p className="mt-0.5 text-2xs text-ink-500">Evidence lookups for the differential in the Knowledge Center</p>
                  <div className="mt-3">
                    <EvidenceChips title="" items={result.differential.map((item) => ({ id: item, label: item, query: item }))} />
                  </div>
                </section>
              ) : null}

              <DisclaimerBar />
            </>
          ) : (
            <EmptyState icon={Stethoscope} title="No triage run yet" description="Enter structured symptom details and click “Run triage” to see the verdict, red flags and recommendations." />
          )}
        </div>
      </div>
    </div>
  );
}

function VitalNote({ reading }: { reading: VitalReading }) {
  if (!reading.value) return <p className="text-2xs text-ink-400">Not entered</p>;
  const tone =
    reading.status === "above" || reading.status === "below" ? "text-severity-high" : reading.status === "low-normal" ? "text-severity-moderate" : "text-severity-low";
  return (
    <p className="text-2xs text-ink-500">
      <span className="font-mono text-ink-900 rs-tabular">{reading.value}</span>
      {reading.unit ? ` ${reading.unit}` : ""}
      {reading.note ? <span className={`ml-1 font-semibold ${tone}`}>· {reading.note}</span> : null}
    </p>
  );
}
