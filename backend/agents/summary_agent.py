from typing import Dict, Any

from backend.services.openai_service import get_ai_provider


class SummaryAgent:
  def __init__(self):
    self.ai = get_ai_provider()

  def create_summaries(self, text: str) -> Dict[str, Any]:
    data = self.ai.summarise(text)
    return {
      "patient_friendly": data["patient_friendly"],
      "clinician_summary": data["clinician_summary"],
    }


def get_summary_agent() -> SummaryAgent:
  return SummaryAgent()

