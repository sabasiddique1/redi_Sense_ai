export const mockPatientProfile = {
  name: "Lien Nguyen",
  mrn: "184920",
  dob: "1968-03-15",
  gender: "Female",
  overview: {
    "Primary care": "Dr. A. Hernandez",
    "Allergies": "Latex, Penicillin",
    "Pre-existing": "HTN, Type 2 DM",
    "Last lab": "2025-02-28",
    "ASA": "II",
    "ICU need": "No",
  },
  reports: [
    { id: "1", modality: "CT chest w/ contrast", date: "2025-03-08", status: "Reviewed", summary: "3mm nodule RUL, stable vs. prior" },
    { id: "2", modality: "CXR", date: "2025-02-20", status: "Pending", summary: "No acute cardiopulmonary process" },
  ],
  medications: [
    "Lisinopril 10mg daily",
    "Metformin 500mg BID",
    "Atorvastatin 20mg nightly",
  ],
  history:
    "62yo F with HTN, DM2. Right upper lobe nodule on surveillance CT. Prior CXR 2024 stable. No smoking x 10 years.",
  aiNotes:
    "AI summary: Interval enlargement of RUL nodule (8→12mm) with spiculation. High confidence for malignancy. Recommend PET-CT and thoracic surgery consult per Fleischner guidelines.",
  alerts: [
    { id: "1", label: "Incidental PE risk", detail: "Segmental PE not in dictated impression" },
  ],
  tasks: [
    { id: "1", label: "Order PET-CT", status: "In progress" },
    { id: "2", label: "Thoracic surgery referral", status: "Pending" },
    { id: "3", label: "Patient discussion", status: "Done" },
  ],
};

/** Demo-only vitals series for the profile page (no vitals table exists in the backend yet). */
export const mockVitalsHistory = [
  { label: "BP", unit: "mmHg", values: [128, 131, 134, 138, 140, 146, 152], secondary: [82, 84, 86, 88, 90, 92, 96], stroke: "var(--rs-severity-high)", caption: "Trending up — recheck next visit" },
  { label: "HR", unit: "bpm", values: [72, 74, 71, 76, 75, 73, 78], stroke: "var(--rs-accent-600)", caption: "Stable within normal range" },
  { label: "SpO2", unit: "%", values: [98, 98, 97, 97, 96, 96, 95], stroke: "var(--rs-accent-600)", caption: "Slight decline over 30 days" },
];
