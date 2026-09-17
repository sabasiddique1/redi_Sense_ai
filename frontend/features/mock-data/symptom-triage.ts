export const mockTriageResult = {
  riskLevel: "Critical" as const,
  summary:
    "Presentation highly concerning for acute coronary syndrome (ACS). Multiple high-risk features: chest pain radiating to arm, diaphoresis, duration <24h. Recommend immediate ECG, troponin, and emergency evaluation. Do not delay for outpatient workup.",
  differential: [
    "Acute coronary syndrome",
    "PE (less likely given arm radiation)",
    "Aortic dissection",
    "Pericarditis",
  ],
  redFlags: [
    "Chest pain radiating to left arm",
    "Diaphoresis",
    "Acute onset (<24h)",
    "Age >60 with cardiac risk factors",
  ],
  recommendedAction: "Emergency department — immediate evaluation",
  actionDetail:
    "Activate chest pain protocol. Order stat ECG, troponin, CXR. Consider aspirin if no contraindications. Do not send home.",
};

/** Demo-only contributor weights (design page 02). Connected mode has no source for these yet. */
export const mockTriageContributors = [
  { label: "Radiating pain", weight: 90 },
  { label: "Diaphoresis", weight: 74 },
  { label: "Elevated BP/HR", weight: 58 },
  { label: "Cardiac history", weight: 22 },
];
