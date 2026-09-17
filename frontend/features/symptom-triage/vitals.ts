import type { TriageDraft } from "@/lib/contracts";

export type VitalStatus = "normal" | "above" | "below" | "low-normal" | null;

export type VitalReading = {
  id: "bp" | "hr" | "temp" | "spo2";
  label: string;
  /** Formatted value for display, empty string when not entered */
  value: string;
  unit: string;
  status: VitalStatus;
  note: string;
};

const parse = (value: string): number | null => {
  const n = Number(value.trim());
  return value.trim() && Number.isFinite(n) ? n : null;
};

/** Reference-range annotations for the four intake vitals (adult ranges). */
export function assessVitals(draft: Pick<TriageDraft, "systolicBp" | "diastolicBp" | "heartRate" | "temperatureC" | "spo2">): VitalReading[] {
  const sys = parse(draft.systolicBp);
  const dia = parse(draft.diastolicBp);
  const hr = parse(draft.heartRate);
  const temp = parse(draft.temperatureC);
  const spo2 = parse(draft.spo2);

  let bpStatus: VitalStatus = null;
  if (sys != null || dia != null) {
    if ((sys ?? 0) >= 140 || (dia ?? 0) >= 90) bpStatus = "above";
    else if ((sys != null && sys < 90) || (dia != null && dia < 60)) bpStatus = "below";
    else bpStatus = "normal";
  }
  let hrStatus: VitalStatus = null;
  if (hr != null) hrStatus = hr > 100 ? "above" : hr < 50 ? "below" : "normal";
  let tempStatus: VitalStatus = null;
  if (temp != null) tempStatus = temp >= 38 ? "above" : temp < 36 ? "below" : "normal";
  let spo2Status: VitalStatus = null;
  if (spo2 != null) spo2Status = spo2 < 94 ? "below" : spo2 < 96 ? "low-normal" : "normal";

  const note = (status: VitalStatus, above = "above range", below = "below range") =>
    status === "above" ? above : status === "below" ? below : status === "low-normal" ? "low-normal" : status === "normal" ? "normal" : "";

  return [
    { id: "bp", label: "BP (sys/dia)", value: sys != null || dia != null ? `${sys ?? "–"} / ${dia ?? "–"}` : "", unit: "mmHg", status: bpStatus, note: note(bpStatus) },
    { id: "hr", label: "Heart rate", value: hr != null ? String(hr) : "", unit: "bpm", status: hrStatus, note: note(hrStatus) },
    { id: "temp", label: "Temp", value: temp != null ? `${temp.toFixed(1)}°C` : "", unit: "", status: tempStatus, note: note(tempStatus, "fever", "low") },
    { id: "spo2", label: "SpO2", value: spo2 != null ? `${spo2}%` : "", unit: "", status: spo2Status, note: note(spo2Status, "above range", "low") },
  ];
}
