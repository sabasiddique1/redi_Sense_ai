from typing import Dict, Any

from sqlalchemy.orm import Session

from backend.agents.report_agent import get_report_agent
from backend.agents.triage_agent import get_triage_agent
from backend.agents.evidence_agent import get_evidence_agent
from backend.agents.summary_agent import get_summary_agent
from backend.services.openai_service import get_ai_provider


class CopilotAgent:
  def __init__(self):
    self.report_agent = get_report_agent()
    self.triage_agent = get_triage_agent()
    self.evidence_agent = get_evidence_agent()
    self.summary_agent = get_summary_agent()
    self.ai = get_ai_provider()

  def handle_report(self, db: Session, patient_id: int | None, text: str) -> Dict[str, Any]:
    return self.report_agent.analyze_report(db, patient_id, text)

  def handle_triage(self, db: Session, patient_id: int | None, symptoms: str) -> Dict[str, Any]:
    return self.triage_agent.triage(db, patient_id, symptoms)

  def handle_evidence(self, query: str) -> Dict[str, Any]:
    return self.evidence_agent.search_evidence(query)

  def handle_summary(self, text: str) -> Dict[str, Any]:
    return self.summary_agent.create_summaries(text)

  def chat(self, message: str, context: str | None = None) -> Dict[str, Any]:
    reply = self.ai.chat(message, context=context)
    return {"reply": reply}


def get_copilot_agent() -> CopilotAgent:
  return CopilotAgent()

