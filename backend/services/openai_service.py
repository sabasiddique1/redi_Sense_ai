from typing import Any, Dict, List

from openai import OpenAI

from backend.config import get_settings


settings = get_settings()
_client: OpenAI | None = None


def get_client() -> OpenAI:
  global _client
  if _client is None:
    _client = OpenAI(api_key=settings.openai_api_key)
  return _client


def _chat(system_prompt: str, user_content: str) -> str:
  client = get_client()
  model = settings.openai_model
  response = client.chat.completions.create(
    model=model,
    messages=[
      {"role": "system", "content": system_prompt},
      {"role": "user", "content": user_content},
    ],
    temperature=0.2,
  )
  return response.choices[0].message.content or ""


def generate_report_analysis(text: str) -> Dict[str, Any]:
  system = (
    "You are an expert radiology / diagnostics assistant. "
    "Given a medical report, classify it, extract key findings, and summarise clearly."
  )
  prompt = (
    "Analyze the following medical report.\n\n"
    "Return JSON with keys: classification (string), key_findings (array of short strings), "
    "summary (short paragraph).\n\n"
    f"Report:\n{text}"
  )
  content = _chat(system, prompt)
  # For robustness, fall back if parsing fails
  try:
    import json

    data = json.loads(content)
    return {
      "classification": data.get("classification", "Unspecified"),
      "key_findings": data.get("key_findings", []),
      "summary": data.get("summary", ""),
    }
  except Exception:
    return {
      "classification": "Unspecified",
      "key_findings": [],
      "summary": content.strip(),
    }


def triage_symptoms(symptoms: str) -> Dict[str, Any]:
  system = (
    "You are a triage decision support assistant. "
    "You do not make diagnoses, but you highlight risk and red flags."
  )
  prompt = (
    "Given the following symptoms, perform a triage-style assessment.\n"
    "Return JSON with keys: risk_level (Low/Moderate/High/Critical), "
    "red_flags (array of strings), recommended_action (string).\n\n"
    f"Symptoms:\n{symptoms}"
  )
  content = _chat(system, prompt)
  try:
    import json

    data = json.loads(content)
    return {
      "risk_level": data.get("risk_level", "Moderate"),
      "red_flags": data.get("red_flags", []),
      "recommended_action": data.get("recommended_action", ""),
    }
  except Exception:
    return {
      "risk_level": "Moderate",
      "red_flags": [],
      "recommended_action": content.strip(),
    }


def generate_clinician_summary(text: str) -> Dict[str, str]:
  system = (
    "You create dual-layer summaries: one for clinicians and one for patients. "
    "Be concise and avoid PHI fabrication."
  )
  prompt = (
    "Summarise the following clinical context in two ways.\n"
    "Return JSON with keys: patient_friendly (string), clinician_summary (string).\n\n"
    f"Context:\n{text}"
  )
  content = _chat(system, prompt)
  try:
    import json

    data = json.loads(content)
    return {
      "patient_friendly": data.get("patient_friendly", ""),
      "clinician_summary": data.get("clinician_summary", ""),
    }
  except Exception:
    return {
      "patient_friendly": content.strip(),
      "clinician_summary": content.strip(),
    }


def chat_with_copilot(message: str, context: str | None = None) -> str:
  system = (
    "You are ReportIQ, an AI healthcare copilot. "
    "You help clinicians interpret reports, triage symptoms, and reference guidelines. "
    "You never give definitive diagnoses or treatment orders."
  )
  if context:
    user = f"Context:\n{context}\n\nUser message:\n{message}"
  else:
    user = message
  return _chat(system, user)


# Simple provider abstraction


class AIProvider:
  def analyze_report(self, text: str) -> Dict[str, Any]:
    return generate_report_analysis(text)

  def triage(self, symptoms: str) -> Dict[str, Any]:
    return triage_symptoms(symptoms)

  def summarise(self, text: str) -> Dict[str, str]:
    return generate_clinician_summary(text)

  def chat(self, message: str, context: str | None = None) -> str:
    return chat_with_copilot(message, context=context)


def get_ai_provider() -> AIProvider:
  # Later this can branch to Gemini / Nova based on settings
  return AIProvider()

