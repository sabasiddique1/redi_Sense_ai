export const mockTriageResult = {
  riskLevel: "Critical" as const,
  summary:
    "Presentation highly concerning for acute coronary syndrome (ACS). Multiple high-risk features: chest pain radiating to arm, diaphoresis, duration &lt;24h. Recommend immediate ECG, troponin, and emergency evaluation. Do not delay for outpatient workup.",
  differential: [
    "Acute coronary syndrome",
    "PE (less likely given arm radiation)",
    "Aortic dissection",
    "Pericarditis",
  ],
  redFlags: [
    "Chest pain radiating to left arm",
    "Diaphoresis",
    "Acute onset (&lt;24h)",
    "Age &gt;60 with cardiac risk factors",
  ],
  recommendedAction: "Emergency department — immediate evaluation",
  actionDetail:
    "Activate chest pain protocol. Order stat ECG, troponin, CXR. Consider aspirin if no contraindications. Do not send home.",
};
