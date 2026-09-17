from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


CLINICAL_DISCLAIMER = (
  "Clinical decision support only. Verify findings with licensed clinical judgment."
)
AiMode = Literal["openai", "heuristic", "extraction_only", "search_fallback"]
FallbackReason = Literal[
  "openai_timeout",
  "openai_api_key_missing",
  "openai_rate_limit",
  "openai_bad_response",
  "json_parse_failed",
  "provider_unavailable",
  "vector_index_missing",
  "search_error",
  "lexical_search_fallback",
  "unknown_error",
]

TRIAGE_SEX_VALUES = {"female", "male", "other"}
TRIAGE_DURATION_UNIT_VALUES = {"minutes", "hours", "days", "weeks", "months", "years"}
TRIAGE_LOCATION_VALUES = {
  "back",
  "neck",
  "chest",
  "abdomen",
  "head",
  "face_mouth",
  "throat",
  "pelvis_flank",
  "urinary_genital",
  "arm_leg",
  "joint",
  "skin",
  "generalized",
  "other",
}
TRIAGE_RADIATION_VALUES = {
  "none",
  "neck",
  "arm",
  "jaw",
  "shoulder",
  "leg",
  "groin",
  "abdomen",
  "other",
}
TRIAGE_ASSOCIATED_SYMPTOM_VALUES = {
  "numbness_tingling",
  "weakness",
  "shortness_of_breath",
  "chest_pressure",
  "fever",
  "chills",
  "nausea_vomiting",
  "cough",
  "sore_throat",
  "runny_nose",
  "diarrhea",
  "urinary_symptoms",
  "weight_loss",
  "headache",
  "dizziness",
  "palpitations",
  "fatigue",
  "rash",
  "swelling",
  "vision_change",
  "confusion",
}
TRIAGE_FACTOR_VALUES = {
  "movement",
  "exertion",
  "sitting",
  "standing",
  "walking",
  "lifting",
  "deep_breathing",
  "coughing",
  "eating",
  "swallowing",
  "urination",
  "stress",
  "lying_flat",
  "rest",
  "stretching",
  "heat_ice",
  "otc_pain_meds",
  "position_change",
  "hydration",
  "inhaler",
  "antacid",
  "nothing",
}
TRIAGE_RED_FLAG_VALUES = {
  "fainting",
  "severe_breathing_trouble",
  "new_confusion",
  "seizure_or_worst_headache",
  "speech_or_facial_change",
  "new_weakness_or_numbness",
  "bowel_bladder_change",
  "saddle_anesthesia",
  "recent_major_trauma",
  "unable_to_walk",
  "persistent_vomiting",
  "high_fever",
  "severe_allergic_swelling",
  "heavy_bleeding",
}
TRIAGE_HISTORY_VALUES = {
  "chronic_back_pain",
  "recent_strain_or_lifting",
  "heart_disease",
  "hypertension",
  "blood_clot_history",
  "asthma_lung_disease",
  "cancer_history",
  "osteoporosis",
  "kidney_stone_history",
  "pregnancy",
  "diabetes",
  "immunocompromised",
  "recent_surgery_or_immobility",
  "stroke_or_seizure_history",
  "smoker",
}


class ApiModel(BaseModel):
  model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class PatientListItem(ApiModel):
  id: int
  mrn: str | None = None
  name: str
  dob: date | None = None
  gender: str | None = None


class ReportListItem(ApiModel):
  id: int
  patient_id: int | None = None
  title: str | None = None
  modality: str | None = None
  classification: str | None = None
  summary: str | None = None
  created_at: datetime


class PatientAlert(BaseModel):
  id: str
  label: str
  detail: str


class PatientTask(BaseModel):
  id: str
  label: str
  status: str


class PatientProfileResponse(ApiModel):
  id: int
  mrn: str | None = None
  name: str
  dob: date | None = None
  gender: str | None = None
  primary_clinician: str | None = None
  allergies: list[str] = Field(default_factory=list)
  conditions: list[str] = Field(default_factory=list)
  medications: list[str] = Field(default_factory=list)
  history_summary: str | None = None
  ai_notes: str | None = None
  profile_metadata: dict[str, Any] = Field(default_factory=dict)
  alerts: list[PatientAlert] = Field(default_factory=list)
  tasks: list[PatientTask] = Field(default_factory=list)
  recent_reports: list[ReportListItem] = Field(default_factory=list)
  created_at: datetime


class TimelineEventResponse(ApiModel):
  id: int
  patient_id: int
  event_type: str
  title: str
  summary: str
  metadata: dict[str, Any] = Field(alias="event_metadata", default_factory=dict)
  timestamp: datetime


class ReportAnalysisRequest(BaseModel):
  patient_id: int | None = None
  report_text: str = Field(min_length=20, max_length=50000)


class ReportAnalysisResponse(BaseModel):
  report_id: int
  patient_id: int | None = None
  classification: str
  key_findings: list[str] = Field(default_factory=list)
  summary: str
  predicted_category: str | None = None
  plain_language_summary: str | None = None
  top_keywords: list[str] = Field(default_factory=list)
  extracted_findings: list[str] = Field(default_factory=list)
  follow_up_recommendations: list[str] = Field(default_factory=list)
  safety_flags: list[str] = Field(default_factory=list)
  structured_data: dict[str, Any] = Field(default_factory=dict)
  disclaimer: str = CLINICAL_DISCLAIMER
  mode: Literal["real", "fallback"]
  ai_mode: AiMode | None = None
  fallback_reason: FallbackReason | None = None
  timeline_event_id: int | None = None
  created_at: datetime


class ReportUploadResponse(ReportAnalysisResponse):
  filename: str
  mime_type: str | None = None
  text_preview: str


class TriageVitalsInput(BaseModel):
  systolic_bp: int | None = Field(default=None, ge=40, le=300)
  diastolic_bp: int | None = Field(default=None, ge=20, le=200)
  heart_rate: int | None = Field(default=None, ge=20, le=250)
  temperature_c: float | None = Field(default=None, ge=30, le=45)
  spo2: int | None = Field(default=None, ge=50, le=100)


class TriageStructuredInput(BaseModel):
  age: int | None = Field(default=None, ge=0, le=120)
  sex: str | None = None
  main_symptom: str = Field(min_length=2, max_length=200)
  duration_value: int | None = Field(default=None, ge=0, le=5000)
  duration_unit: str | None = None
  severity: int | None = Field(default=None, ge=0, le=10)
  location: str | None = None
  location_detail: str | None = Field(default=None, max_length=120)
  radiation: list[str] = Field(default_factory=list)
  radiation_detail: str | None = Field(default=None, max_length=120)
  associated_symptoms: list[str] = Field(default_factory=list)
  aggravating_factors: list[str] = Field(default_factory=list)
  relieving_factors: list[str] = Field(default_factory=list)
  red_flags: list[str] = Field(default_factory=list)
  no_red_flags: bool = False
  relevant_history: list[str] = Field(default_factory=list)
  history_detail: str | None = Field(default=None, max_length=300)
  additional_details: str | None = Field(default=None, max_length=800)
  vitals: TriageVitalsInput | None = None

  @field_validator("sex")
  @classmethod
  def validate_sex(cls, value: str | None):
    if value is None:
      return value
    if value not in TRIAGE_SEX_VALUES:
      raise ValueError("Invalid sex value")
    return value

  @field_validator("duration_unit")
  @classmethod
  def validate_duration_unit(cls, value: str | None):
    if value is None:
      return value
    if value not in TRIAGE_DURATION_UNIT_VALUES:
      raise ValueError("Invalid duration unit")
    return value

  @field_validator("location")
  @classmethod
  def validate_location(cls, value: str | None):
    if value is None:
      return value
    if value not in TRIAGE_LOCATION_VALUES:
      raise ValueError("Invalid location")
    return value

  @field_validator("radiation")
  @classmethod
  def validate_radiation(cls, value: list[str]):
    invalid = [item for item in value if item not in TRIAGE_RADIATION_VALUES]
    if invalid:
      raise ValueError(f"Invalid radiation values: {', '.join(invalid)}")
    return list(dict.fromkeys(value))

  @field_validator("associated_symptoms")
  @classmethod
  def validate_associated_symptoms(cls, value: list[str]):
    invalid = [item for item in value if item not in TRIAGE_ASSOCIATED_SYMPTOM_VALUES]
    if invalid:
      raise ValueError(f"Invalid associated symptom values: {', '.join(invalid)}")
    return list(dict.fromkeys(value))

  @field_validator("aggravating_factors", "relieving_factors")
  @classmethod
  def validate_factors(cls, value: list[str]):
    invalid = [item for item in value if item not in TRIAGE_FACTOR_VALUES]
    if invalid:
      raise ValueError(f"Invalid factor values: {', '.join(invalid)}")
    return list(dict.fromkeys(value))

  @field_validator("red_flags")
  @classmethod
  def validate_red_flags(cls, value: list[str]):
    invalid = [item for item in value if item not in TRIAGE_RED_FLAG_VALUES]
    if invalid:
      raise ValueError(f"Invalid red flag values: {', '.join(invalid)}")
    return list(dict.fromkeys(value))

  @field_validator("relevant_history")
  @classmethod
  def validate_relevant_history(cls, value: list[str]):
    invalid = [item for item in value if item not in TRIAGE_HISTORY_VALUES]
    if invalid:
      raise ValueError(f"Invalid history values: {', '.join(invalid)}")
    return list(dict.fromkeys(value))

  @model_validator(mode="after")
  def validate_consistency(self):
    if self.no_red_flags and self.red_flags:
      raise ValueError("When no_red_flags is true, red_flags must be empty")
    if (self.duration_value is None) ^ (self.duration_unit is None):
      raise ValueError("duration_value and duration_unit must be provided together")
    return self


class TriageAnalyzeRequest(BaseModel):
  patient_id: int | None = None
  symptoms: str | None = Field(default=None, min_length=5, max_length=10000)
  structured_input: TriageStructuredInput | None = None

  @model_validator(mode="after")
  def validate_input(self):
    if self.structured_input is None and not self.symptoms:
      raise ValueError("Either symptoms or structured_input is required")
    return self


class TriageAnalyzeResponse(BaseModel):
  session_id: int | None = None
  patient_id: int | None = None
  risk_level: Literal["Low", "Moderate", "High", "Critical"] | None = None
  care_level: Literal["Self-care", "Routine", "Urgent", "Emergency"] | None = None
  red_flags: list[str] = Field(default_factory=list)
  recommended_action: str
  summary: str
  differential: list[str] = Field(default_factory=list)
  reasoning: list[str] = Field(default_factory=list)
  disclaimer: str = CLINICAL_DISCLAIMER
  mode: Literal["real", "fallback", "error"]
  ai_mode: AiMode | None = None
  fallback_reason: FallbackReason | None = None
  invalid_input: bool = False
  validation_message: str | None = None
  timeline_event_id: int | None = None
  created_at: datetime | None = None


class CopilotChatRequest(BaseModel):
  message: str = Field(min_length=1, max_length=4000)
  context_patient_id: int | None = None
  conversation_id: int | None = None


class CopilotCitation(BaseModel):
  title: str
  citation_id: str | None = None
  source: str | None = None
  url: str | None = None
  section: str | None = None
  page: int | None = None
  chunk_id: str | None = None
  snippet: str | None = None
  score: float | None = None


class CopilotTraceEvidence(BaseModel):
  citation_id: str
  title: str
  source: str | None = None
  section: str | None = None
  page: int | None = None
  score: float | None = None


class CopilotRagTrace(BaseModel):
  prompt_version: str
  retrieval_query: str
  normalized_query: str | None = None
  retrieval_mode: Literal["real", "fallback", "error"] = "error"
  retrieval_ai_mode: AiMode | None = None
  retrieval_fallback_reason: FallbackReason | None = None
  insufficient_evidence: bool = False
  filters: dict[str, Any] = Field(default_factory=dict)
  retrieved_evidence: list[CopilotTraceEvidence] = Field(default_factory=list)


class CopilotMessageResponse(ApiModel):
  id: int
  role: str
  content: str
  citations: list[CopilotCitation] = Field(default_factory=list)
  metadata: dict[str, Any] = Field(alias="message_metadata", default_factory=dict)
  created_at: datetime


class CopilotConversationSummary(ApiModel):
  id: int
  patient_id: int | None = None
  title: str | None = None
  created_at: datetime
  updated_at: datetime
  message_count: int = 0
  latest_message_preview: str | None = None


class CopilotConversationResponse(ApiModel):
  id: int
  patient_id: int | None = None
  title: str | None = None
  created_at: datetime
  updated_at: datetime
  messages: list[CopilotMessageResponse] = Field(default_factory=list)


class CopilotChatResponse(BaseModel):
  conversation_id: int
  patient_id: int | None = None
  reply: str
  message_id: int
  citations: list[CopilotCitation] = Field(default_factory=list)
  disclaimer: str = CLINICAL_DISCLAIMER
  mode: Literal["real", "fallback"]
  ai_mode: AiMode | None = None
  fallback_reason: FallbackReason | None = None
  context_used: bool = False
  insufficient_evidence: bool = False
  rag_trace: CopilotRagTrace | None = None
  timeline_event_id: int | None = None


class EvidenceSearchRequest(BaseModel):
  query: str = Field(min_length=2, max_length=500)


class EvidenceSource(BaseModel):
  id: str
  title: str
  snippet: str
  source: str | None = None
  url: str | None = None
  section: str | None = None
  page: int | None = None
  score: float


class EvidenceSearchResult(BaseModel):
  query: str
  sources: list[EvidenceSource] = Field(default_factory=list)
  mode: Literal["real", "fallback", "demo", "error"]
  ai_mode: AiMode | None = None
  fallback_reason: FallbackReason | None = None
  latency_ms: int = 0
  error_message: str | None = None
  trace: dict[str, Any] | None = None


class PublicConfigResponse(BaseModel):
  auth_enabled: bool
  demo_mode_enabled: bool
  openai_chat_model: str
  openai_embedding_model: str


RiskLevel = Literal["Low", "Moderate", "High", "Critical"]


class DashboardDelta(BaseModel):
  direction: Literal["up", "down", "flat"]
  label: str


class DashboardSecondary(BaseModel):
  value: str
  label: str
  tone: RiskLevel | None = None


class DashboardMetric(BaseModel):
  id: str
  label: str
  value: str | None = None
  unit: str | None = None
  trend: Literal["up", "down", "neutral"] = "neutral"
  trend_label: str
  delta: DashboardDelta | None = None
  series: list[int] | None = None
  footnote: str | None = None
  pill: str | None = None
  secondary: DashboardSecondary | None = None


class DashboardReportRow(BaseModel):
  id: str
  patient_name: str
  patient_id: str
  mrn: str | None = None
  modality: str
  summary: str
  risk: RiskLevel
  confidence: int | None = Field(default=None, ge=0, le=100)
  received_at: datetime | None = None
  minutes_in_queue: int | None = None


class DashboardAlert(BaseModel):
  id: str
  label: str
  patient_name: str
  detail: str
  severity: Literal["High", "Critical"]
  elapsed_minutes: int | None = None
  sla_minutes: int = 30


class DashboardInsight(BaseModel):
  id: str
  title: str
  summary: str
  confidence: int = Field(ge=0, le=100)
  record_count: int | None = Field(default=None, ge=0)


class DashboardRiskBucket(BaseModel):
  label: RiskLevel
  value: int = Field(ge=0)


class DashboardLabelledValue(BaseModel):
  label: str
  value: int = Field(ge=0)


class DashboardActivityItem(BaseModel):
  id: str
  timestamp: datetime | None = None
  label: str
  detail: str
  event_type: str
  patient_id: int | None = None
  patient_name: str | None = None


class DashboardSummaryResponse(BaseModel):
  generated_at: datetime
  risk_window_days: int
  trend_days: int = 7
  metrics: list[DashboardMetric] = Field(default_factory=list)
  reports_by_risk: list[DashboardRiskBucket] = Field(default_factory=list)
  reports_by_risk_caption: str | None = None
  modality_mix: list[DashboardLabelledValue] = Field(default_factory=list)
  modality_total: int = 0
  hourly: list[DashboardLabelledValue] = Field(default_factory=list)
  hourly_target: int | None = None
  hourly_caption: str | None = None
  reports_queue: list[DashboardReportRow] = Field(default_factory=list)
  reports_total: int = 0
  urgent_alerts: list[DashboardAlert] = Field(default_factory=list)
  ai_insight: DashboardInsight
  risk_distribution: list[DashboardRiskBucket] = Field(default_factory=list)
  recent_activity: list[DashboardActivityItem] = Field(default_factory=list)
  disclaimer: str = CLINICAL_DISCLAIMER
  mode: Literal["real"] = "real"
