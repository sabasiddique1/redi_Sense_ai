from typing import Dict, Any

from sqlalchemy.orm import Session

from backend.db import models
from backend.services.openai_service import get_ai_provider


class ReportAgent:
  def __init__(self):
    self.ai = get_ai_provider()

  def analyze_report(self, db: Session, patient_id: int | None, report_text: str) -> Dict[str, Any]:
    ai_result = self.ai.analyze_report(report_text)

    report = models.MedicalReport(
      patient_id=patient_id,
      report_text=report_text,
      classification=ai_result["classification"],
    )
    db.add(report)
    db.flush()

    ai_response = models.AIResponse(
      report_id=report.id,
      role="report_analysis",
      request_text=report_text,
      response_text=ai_result["summary"],
    )
    db.add(ai_response)
    db.commit()
    db.refresh(report)

    return {
      "report_id": report.id,
      "classification": ai_result["classification"],
      "key_findings": ai_result["key_findings"],
      "summary": ai_result["summary"],
    }


def get_report_agent() -> ReportAgent:
  return ReportAgent()

