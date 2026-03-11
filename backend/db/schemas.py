from datetime import datetime, date
from typing import Optional, List

from pydantic import BaseModel


class PatientBase(BaseModel):
  name: str
  dob: Optional[date] = None
  gender: Optional[str] = None


class PatientCreate(PatientBase):
  pass


class Patient(PatientBase):
  id: int
  created_at: datetime

  class Config:
    from_attributes = True


class MedicalReportBase(BaseModel):
  patient_id: int
  report_text: str
  classification: Optional[str] = None


class MedicalReportCreate(MedicalReportBase):
  pass


class MedicalReport(MedicalReportBase):
  id: int
  created_at: datetime

  class Config:
    from_attributes = True


class TriageSessionBase(BaseModel):
  patient_id: Optional[int] = None
  symptoms: str
  risk_level: Optional[str] = None


class TriageSessionCreate(TriageSessionBase):
  pass


class TriageSession(TriageSessionBase):
  id: int
  created_at: datetime

  class Config:
    from_attributes = True


class TimelineEventBase(BaseModel):
  patient_id: int
  event_type: str
  description: str
  timestamp: Optional[datetime] = None


class TimelineEventCreate(TimelineEventBase):
  pass


class TimelineEvent(TimelineEventBase):
  id: int

  class Config:
    from_attributes = True


class AIResponse(BaseModel):
  id: int
  role: str
  request_text: str
  response_text: str
  created_at: datetime

  class Config:
    from_attributes = True


class AuditLog(BaseModel):
  id: int
  action: str
  resource_type: Optional[str]
  resource_id: Optional[str]
  timestamp: datetime
  detail: Optional[str]

  class Config:
    from_attributes = True


# Payloads for API endpoints


class ReportAnalysisRequest(BaseModel):
  patient_id: Optional[int] = None
  report_text: str


class ReportAnalysisResult(BaseModel):
  classification: str
  key_findings: List[str]
  summary: str


class TriageAnalyzeRequest(BaseModel):
  patient_id: Optional[int] = None
  symptoms: str


class TriageAnalyzeResult(BaseModel):
  risk_level: str
  red_flags: List[str]
  recommended_action: str


class CopilotChatRequest(BaseModel):
  message: str
  context_patient_id: Optional[int] = None


class CopilotChatResponse(BaseModel):
  reply: str


class EvidenceSearchRequest(BaseModel):
  query: str


class EvidenceSource(BaseModel):
  id: str
  title: str
  snippet: str
  url: Optional[str] = None


class EvidenceSearchResult(BaseModel):
  sources: List[EvidenceSource]

