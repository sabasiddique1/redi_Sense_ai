from __future__ import annotations

from datetime import date
from functools import lru_cache
import logging
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.db import models
from backend.services.openai_service import get_ai_provider
from backend.services.timeline_service import create_timeline_event
from backend.services.triage_service import (
  build_grounded_triage_assessment,
  build_triage_model_input,
  format_structured_triage_input,
  merge_triage_with_model,
  normalize_structured_triage_input,
  validate_triage_input,
)


logger = logging.getLogger(__name__)


def _age_from_dob(dob: date | None) -> int | None:
  if dob is None:
    return None

  today = date.today()
  return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _format_list(values: list[str] | None, *, limit: int = 5) -> str | None:
  if not values:
    return None

  cleaned = [value.strip() for value in values if isinstance(value, str) and value.strip()]
  if not cleaned:
    return None
  return ", ".join(cleaned[:limit])


def _build_patient_context_data(patient: models.Patient | None) -> dict[str, Any] | None:
  if patient is None:
    return None

  return {
    "age": _age_from_dob(patient.dob),
    "sex": patient.gender.lower() if patient.gender else None,
    "conditions": patient.conditions or [],
    "medications": patient.medications or [],
    "allergies": patient.allergies or [],
    "history_summary": patient.history_summary.strip()[:240]
    if patient.history_summary and patient.history_summary.strip()
    else None,
  }


def _build_patient_context_text(patient_context: dict[str, Any] | None) -> str | None:
  if not patient_context:
    return None

  lines: list[str] = []
  demographics: list[str] = []
  if patient_context.get("age") is not None:
    demographics.append(f"{patient_context['age']}-year-old")
  if patient_context.get("sex"):
    demographics.append(str(patient_context["sex"]))
  if demographics:
    lines.append(f"Patient demographics: {' '.join(demographics)}")

  conditions = _format_list(patient_context.get("conditions"))
  if conditions:
    lines.append(f"Known conditions: {conditions}")

  medications = _format_list(patient_context.get("medications"))
  if medications:
    lines.append(f"Current medications: {medications}")

  allergies = _format_list(patient_context.get("allergies"))
  if allergies:
    lines.append(f"Allergies: {allergies}")

  history_summary = patient_context.get("history_summary")
  if history_summary:
    lines.append(f"Relevant history: {history_summary}")

  return "\n".join(lines) if lines else None


class TriageAgent:
  def __init__(self):
    self.ai = get_ai_provider()

  def triage(
    self,
    db: Session,
    patient_id: int | None,
    symptoms: str | None,
    structured_input: dict[str, Any] | None = None,
  ) -> dict[str, Any]:
    patient = None
    if patient_id is not None:
      patient = db.get(models.Patient, patient_id)
      if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient_context = _build_patient_context_data(patient)
    patient_context_text = _build_patient_context_text(patient_context)

    normalized_input = None
    if structured_input is None:
      validation = validate_triage_input(symptoms or "")
      if not validation.is_valid:
        logger.info(
          "Triage input rejected patient_id=%s reason=%s",
          patient_id,
          validation.message,
        )
        return {
          "session_id": None,
          "patient_id": patient_id,
          "risk_level": None,
          "care_level": None,
          "red_flags": [],
          "recommended_action": (
            "Please enter actual symptoms for triage, including what the patient is feeling, "
            "duration, severity, and any warning signs."
          ),
          "summary": validation.message
          or "I could not identify symptoms suitable for triage in that text.",
          "differential": [],
          "reasoning": [],
          "mode": "error",
          "ai_mode": None,
          "fallback_reason": None,
          "invalid_input": True,
          "validation_message": validation.message,
          "timeline_event_id": None,
          "created_at": None,
        }

      normalized_symptoms = validation.normalized_text
      grounded_result = build_grounded_triage_assessment(normalized_symptoms)
      ai_input = (
        f"{patient_context_text}\nSymptoms:\n{normalized_symptoms}"
        if patient_context_text
        else normalized_symptoms
      )
    else:
      normalized_input = normalize_structured_triage_input(structured_input, patient_context)
      normalized_symptoms = format_structured_triage_input(normalized_input)
      grounded_result = build_grounded_triage_assessment(
        normalized_symptoms,
        structured_input=structured_input,
        patient_context=patient_context,
      )
      ai_input = build_triage_model_input(
        normalized_input,
        grounded_result,
        patient_context_text,
      )

    ai_result = self.ai.triage(ai_input)
    fallback_reason = (
      ai_result.get("fallback_reason")
      if ai_result["mode"] == "openai"
      else ai_result.get("fallback_reason") or "unknown_error"
    )
    response_mode = "real" if ai_result["mode"] == "openai" else "fallback"
    triage_result = (
      merge_triage_with_model(grounded_result, ai_result, normalized_input=normalized_input)
      if ai_result["mode"] == "openai"
      else grounded_result
    )
    logger.info(
      "Triage assessment generated patient_id=%s mode=%s ai_mode=%s fallback_reason=%s risk_level=%s structured=%s",
      patient_id,
      response_mode,
      ai_result["mode"],
      fallback_reason,
      triage_result["risk_level"],
      structured_input is not None,
    )

    triage_session = models.TriageSession(
      patient_id=patient_id,
      symptoms=normalized_symptoms,
      risk_level=triage_result["risk_level"],
      red_flags=triage_result.get("red_flags", []),
      recommended_action=triage_result["recommended_action"],
      summary=triage_result["summary"],
      differential=triage_result.get("differential", []),
      analysis_model=None,
      analysis_source=ai_result["mode"],
    )
    db.add(triage_session)
    db.flush()

    timeline_event = create_timeline_event(
      db,
      patient_id=patient_id,
      event_type="triage_completed",
      title=f"Triage: {triage_result['risk_level']} risk",
      summary=triage_result["summary"],
      metadata={
        "triage_session_id": triage_session.id,
        "risk_level": triage_result["risk_level"],
        "care_level": triage_result.get("care_level"),
        "red_flags": triage_result.get("red_flags", []),
        "reasoning": triage_result.get("reasoning", []),
        "ai_mode": ai_result["mode"],
        "fallback_reason": fallback_reason,
      },
    )
    db.commit()
    db.refresh(triage_session)
    if timeline_event is not None:
      db.refresh(timeline_event)
    logger.info(
      "Triage persisted patient_id=%s session_id=%s timeline_event_id=%s",
      patient_id,
      triage_session.id,
      timeline_event.id if timeline_event else None,
    )

    return {
      "session_id": triage_session.id,
      "patient_id": triage_session.patient_id,
      "risk_level": triage_result["risk_level"],
      "care_level": triage_result.get("care_level"),
      "red_flags": triage_result["red_flags"],
      "recommended_action": triage_result["recommended_action"],
      "summary": triage_result["summary"],
      "differential": triage_result.get("differential", []),
      "reasoning": triage_result.get("reasoning", []),
      "mode": response_mode,
      "ai_mode": ai_result["mode"],
      "fallback_reason": fallback_reason,
      "invalid_input": False,
      "validation_message": None,
      "timeline_event_id": timeline_event.id if timeline_event else None,
      "created_at": triage_session.created_at,
    }


@lru_cache(maxsize=1)
def get_triage_agent() -> TriageAgent:
  return TriageAgent()
