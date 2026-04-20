export const mockReportAnalysis = {
  reportPreview:
    "CT CHEST WITH CONTRAST\n\nClinical: Follow-up right upper lobe nodule.\n\nFindings: Interval enlargement of the previously noted 8mm right upper lobe nodule, now measuring 12mm. Subtle spiculation and increased density. No new pulmonary nodules. Mediastinal lymph nodes stable. No pleural effusion.\n\nImpression: Interval enlargement of right upper lobe nodule, concerning for malignancy. Recommend PET-CT and thoracic surgery consultation.",
  category: "Radiology — Pulmonary nodule (suspicious)",
  confidence: 94,
  plainLanguageSummary:
    "The CT describes a lung nodule that has grown from 8mm to 12mm since the last scan. The spiculated appearance can be associated with malignancy, and the radiologist recommends further imaging and surgical consultation.",
  topKeywords: [
    "nodule",
    "enlargement",
    "spiculation",
    "malignancy",
    "PET-CT",
    "thoracic surgery",
  ],
  findings: [
    "Right upper lobe nodule: 8mm → 12mm (interval enlargement)",
    "Spiculation and increased density",
    "No new pulmonary nodules",
    "Mediastinal lymph nodes stable",
    "Recommend PET-CT and thoracic surgery consultation",
  ],
  urgency: "High",
  suggestedNextSteps: [
    "Order PET-CT for staging",
    "Refer to thoracic surgery",
    "Discuss findings with patient and family",
    "Document in care plan",
  ],
  citedEvidence: [
    {
      id: "1",
      title: "Fleischner Society 2017 Guidelines — Pulmonary Nodules",
      source: "Radiology. 2017;284(1):228-243",
    },
    {
      id: "2",
      title: "ACCP Evidence-Based Clinical Practice Guidelines",
      source: "Chest. 2013;143(5 Suppl):e93S-e120S",
    },
  ],
  structuredData: {
    modality: "CT",
    bodyPart: "Chest",
    finding: "Pulmonary nodule",
    size: "12mm",
    change: "Interval enlargement",
    recommendation: "PET-CT, thoracic surgery consult",
  },
};
