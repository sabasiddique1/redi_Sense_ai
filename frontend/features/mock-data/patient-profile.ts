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
    { id: "1", modality: "CT chest w/ contrast", date: "2025-03-08", status: "Reviewed" },
    { id: "2", modality: "CXR", date: "2025-02-20", status: "Pending" },
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
