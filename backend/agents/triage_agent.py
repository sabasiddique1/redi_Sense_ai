from typing import Dict, Any

from sqlalchemy.orm import Session

from backend.db import models
from backend.services.openai_service import get_ai_provider


class TriageAgent:
  def __init__(self):
    self.ai = get_ai_provider()

  def triage(self, db: Session, patient_id: int | None, symptoms: str) -> Dict[str, Any]:
    ai_result = self.ai.triage(symptoms)

    triage_session = models.TriageSession(
      patient_id=patient_id,
      symptoms=symptoms,
      risk_level=ai_result["risk_level"],
    )
    db.add(triage_session)
    db.flush()

    ai_response = models.AIResponse(
      triage_session_id=triage_session.id,
      role="triage",
      request_text=symptoms,
      response_text=ai_result["recommended_action"],
    )
    db.add(ai_response)
    db.commit()
    db.refresh(triage_session)

    return {
      "session_id": triage_session.id,
      "risk_level": ai_result["risk_level"],
      "red_flags": ai_result["red_flags"],
      "recommended_action": ai_result["recommended_action"],
    }


def get_triage_agent() -> TriageAgent:
  return TriageAgent()

