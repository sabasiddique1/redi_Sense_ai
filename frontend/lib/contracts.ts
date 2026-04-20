export type ApiSource = "api" | "demo";
export type ResultMode = "real" | "fallback" | "demo" | "error";
export type AiMode =
  | "openai"
  | "heuristic"
  | "extraction_only"
  | "search_fallback"
  | null;
export type FallbackReason =
  | "openai_timeout"
  | "openai_api_key_missing"
  | "openai_rate_limit"
  | "openai_bad_response"
  | "json_parse_failed"
  | "provider_unavailable"
  | "vector_index_missing"
  | "search_error"
  | "lexical_search_fallback"
  | "unknown_error";
export type TriageCareLevel = "Self-care" | "Routine" | "Urgent" | "Emergency";
export type TriageSex = "female" | "male" | "other";
export type TriageDurationUnit = "minutes" | "hours" | "days" | "weeks" | "months" | "years";
export type TriageLocation =
  | "back"
  | "neck"
  | "chest"
  | "abdomen"
  | "head"
  | "face_mouth"
  | "throat"
  | "pelvis_flank"
  | "urinary_genital"
  | "arm_leg"
  | "joint"
  | "skin"
  | "generalized"
  | "other";
export type TriageRadiation =
  | "none"
  | "neck"
  | "arm"
  | "jaw"
  | "shoulder"
  | "leg"
  | "groin"
  | "abdomen"
  | "other";
export type TriageAssociatedSymptom =
  | "numbness_tingling"
  | "weakness"
  | "shortness_of_breath"
  | "chest_pressure"
  | "fever"
  | "chills"
  | "nausea_vomiting"
  | "cough"
  | "sore_throat"
  | "runny_nose"
  | "diarrhea"
  | "urinary_symptoms"
  | "weight_loss"
  | "headache"
  | "dizziness"
  | "palpitations"
  | "fatigue"
  | "rash"
  | "swelling"
  | "vision_change"
  | "confusion";
export type TriageFactor =
  | "movement"
  | "exertion"
  | "sitting"
  | "standing"
  | "walking"
  | "lifting"
  | "deep_breathing"
  | "coughing"
  | "eating"
  | "swallowing"
  | "urination"
  | "stress"
  | "lying_flat"
  | "rest"
  | "stretching"
  | "heat_ice"
  | "otc_pain_meds"
  | "position_change"
  | "hydration"
  | "inhaler"
  | "antacid"
  | "nothing";
export type TriageRedFlag =
  | "fainting"
  | "severe_breathing_trouble"
  | "new_confusion"
  | "seizure_or_worst_headache"
  | "speech_or_facial_change"
  | "new_weakness_or_numbness"
  | "bowel_bladder_change"
  | "saddle_anesthesia"
  | "recent_major_trauma"
  | "unable_to_walk"
  | "persistent_vomiting"
  | "high_fever"
  | "severe_allergic_swelling"
  | "heavy_bleeding";
export type TriageHistoryItem =
  | "chronic_back_pain"
  | "recent_strain_or_lifting"
  | "heart_disease"
  | "hypertension"
  | "blood_clot_history"
  | "asthma_lung_disease"
  | "cancer_history"
  | "osteoporosis"
  | "kidney_stone_history"
  | "pregnancy"
  | "diabetes"
  | "immunocompromised"
  | "recent_surgery_or_immobility"
  | "stroke_or_seizure_history"
  | "smoker";

export type ApiResult<T> = {
  data: T;
  source: ApiSource;
  mode: ResultMode;
  warning?: string;
};

export type PatientListItem = {
  id: number;
  mrn: string | null;
  name: string;
  dob: string | null;
  gender: string | null;
};

export type ReportListItem = {
  id: number;
  patient_id: number | null;
  title: string | null;
  modality: string | null;
  classification: string | null;
  summary: string | null;
  created_at: string;
};

export type PatientAlert = {
  id: string;
  label: string;
  detail: string;
};

export type PatientTask = {
  id: string;
  label: string;
  status: string;
};

export type PatientProfileResponse = {
  id: number;
  mrn: string | null;
  name: string;
  dob: string | null;
  gender: string | null;
  primary_clinician: string | null;
  allergies: string[];
  conditions: string[];
  medications: string[];
  history_summary: string | null;
  ai_notes: string | null;
  profile_metadata: Record<string, unknown>;
  alerts: PatientAlert[];
  tasks: PatientTask[];
  recent_reports: ReportListItem[];
  created_at: string;
};

export type TimelineEventResponse = {
  id: number;
  patient_id: number;
  event_type: string;
  title: string;
  summary: string;
  metadata: Record<string, unknown>;
  timestamp: string;
};

export type ReportAnalysisPayload = {
  patient_id?: number | null;
  report_text: string;
};

export type ReportAnalysisResponse = {
  report_id: number;
  patient_id: number | null;
  classification: string;
  key_findings: string[];
  summary: string;
  predicted_category?: string | null;
  plain_language_summary?: string | null;
  top_keywords?: string[];
  extracted_findings?: string[];
  follow_up_recommendations?: string[];
  safety_flags?: string[];
  structured_data: Record<string, unknown>;
  disclaimer: string;
  mode: "real" | "fallback" | "demo";
  ai_mode: AiMode;
  fallback_reason?: FallbackReason | null;
  timeline_event_id: number | null;
  created_at: string;
};

export type ReportUploadResponse = ReportAnalysisResponse & {
  filename: string;
  mime_type: string | null;
  text_preview: string;
};

export type TriageAnalyzePayload = {
  patient_id?: number | null;
  symptoms?: string | null;
  structured_input?: TriageStructuredInput | null;
};

export type TriageVitalsInput = {
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  heart_rate?: number | null;
  temperature_c?: number | null;
  spo2?: number | null;
};

export type TriageStructuredInput = {
  age?: number | null;
  sex?: TriageSex | null;
  main_symptom: string;
  duration_value?: number | null;
  duration_unit?: TriageDurationUnit | null;
  severity?: number | null;
  location?: TriageLocation | null;
  location_detail?: string | null;
  radiation?: TriageRadiation[];
  radiation_detail?: string | null;
  associated_symptoms?: TriageAssociatedSymptom[];
  aggravating_factors?: TriageFactor[];
  relieving_factors?: TriageFactor[];
  red_flags?: TriageRedFlag[];
  no_red_flags?: boolean;
  relevant_history?: TriageHistoryItem[];
  history_detail?: string | null;
  additional_details?: string | null;
  vitals?: TriageVitalsInput | null;
};

export type TriageDraft = {
  age: string;
  sex: "" | TriageSex;
  mainSymptom: string;
  durationValue: string;
  durationUnit: TriageDurationUnit;
  severity: string;
  location: "" | TriageLocation;
  locationDetail: string;
  radiation: TriageRadiation[];
  radiationDetail: string;
  associatedSymptoms: TriageAssociatedSymptom[];
  aggravatingFactors: TriageFactor[];
  relievingFactors: TriageFactor[];
  redFlags: TriageRedFlag[];
  noRedFlags: boolean;
  relevantHistory: TriageHistoryItem[];
  historyDetail: string;
  additionalDetails: string;
  systolicBp: string;
  diastolicBp: string;
  heartRate: string;
  temperatureC: string;
  spo2: string;
};

export type TriageAnalyzeResponse = {
  session_id: number | null;
  patient_id: number | null;
  risk_level: "Low" | "Moderate" | "High" | "Critical" | null;
  care_level: TriageCareLevel | null;
  red_flags: string[];
  recommended_action: string;
  summary: string;
  differential: string[];
  reasoning: string[];
  disclaimer: string;
  mode: "real" | "fallback" | "demo" | "error";
  ai_mode: AiMode;
  fallback_reason?: FallbackReason | null;
  invalid_input: boolean;
  validation_message: string | null;
  timeline_event_id: number | null;
  created_at: string | null;
};

export type EvidenceSource = {
  id: string;
  title: string;
  snippet: string;
  source: string | null;
  url: string | null;
  section: string | null;
  page: number | null;
  score: number;
};

export type EvidenceSearchResponse = {
  query: string;
  sources: EvidenceSource[];
  mode: "real" | "fallback" | "demo" | "error";
  ai_mode: AiMode;
  fallback_reason?: FallbackReason | null;
  latency_ms: number;
  error_message: string | null;
  trace?: Record<string, unknown> | null;
};

export type CopilotCitation = {
  title: string;
  citation_id?: string | null;
  source: string | null;
  url: string | null;
  section: string | null;
  page: number | null;
  chunk_id?: string | null;
  snippet?: string | null;
  score?: number | null;
};

export type CopilotChatPayload = {
  message: string;
  context_patient_id?: number | null;
  conversation_id?: number | null;
};

export type CopilotChatResponse = {
  conversation_id: number;
  patient_id: number | null;
  reply: string;
  message_id: number;
  citations: CopilotCitation[];
  disclaimer: string;
  mode: "real" | "fallback" | "demo";
  ai_mode: AiMode;
  fallback_reason?: FallbackReason | null;
  context_used: boolean;
  insufficient_evidence?: boolean;
  rag_trace?: Record<string, unknown> | null;
  timeline_event_id: number | null;
};

export type CopilotConversationMessage = {
  id: number;
  role: string;
  content: string;
  citations: CopilotCitation[];
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CopilotConversationSummary = {
  id: number;
  patient_id: number | null;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  latest_message_preview: string | null;
};

export type CopilotConversationResponse = {
  id: number;
  patient_id: number | null;
  title: string | null;
  created_at: string;
  updated_at: string;
  messages: CopilotConversationMessage[];
};

export type PublicConfigResponse = {
  auth_enabled: boolean;
  demo_mode_enabled: boolean;
  openai_chat_model: string;
  openai_embedding_model: string;
};
