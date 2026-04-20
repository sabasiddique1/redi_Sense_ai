from __future__ import annotations

from functools import lru_cache
import logging
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.db import models
from backend.services.openai_service import (
  get_ai_provider,
  normalize_report_analysis_result,
)
from backend.services.timeline_service import create_timeline_event


logger = logging.getLogger(__name__)


class ReportAgent:
  def __init__(self):
    self.ai = get_ai_provider()

  def analyze_report(
    self,
    db: Session,
    patient_id: int | None,
    report_text: str,
    *,
    title: str | None = None,
    source_filename: str | None = None,
    mime_type: str | None = None,
    file_size_bytes: int | None = None,
  ) -> dict[str, Any]:
    if patient_id is not None and db.get(models.Patient, patient_id) is None:
      raise HTTPException(status_code=404, detail="Patient not found")

    raw_ai_result = self.ai.analyze_report(report_text)
    ai_result = normalize_report_analysis_result(raw_ai_result, report_text)
    fallback_reason = (
      ai_result.get("fallback_reason")
      if ai_result["mode"] == "openai"
      else ai_result.get("fallback_reason") or "unknown_error"
    )
    response_mode = "real" if ai_result["mode"] == "openai" else "fallback"
    logger.info(
      "Report analysis generated patient_id=%s mode=%s ai_mode=%s fallback_reason=%s",
      patient_id,
      response_mode,
      ai_result["mode"],
      fallback_reason,
    )

    report = models.Report(
      patient_id=patient_id,
      title=title or source_filename or "Uploaded report",
      modality=str(ai_result.get("structured_data", {}).get("modality") or "").strip() or None,
      source_filename=source_filename,
      mime_type=mime_type,
      file_size_bytes=file_size_bytes,
      report_text=report_text,
      classification=ai_result["classification"],
      summary=ai_result["summary"],
      key_findings=ai_result.get("key_findings", []),
      structured_data=ai_result.get("structured_data", {}),
      analysis_model=None,
      analysis_source=ai_result["mode"],
    )
    db.add(report)
    db.flush()

    timeline_event = create_timeline_event(
      db,
      patient_id=patient_id,
      event_type="report_uploaded",
      title=report.title or "Report analyzed",
      summary=ai_result["summary"],
      metadata={
        "report_id": report.id,
        "classification": ai_result["classification"],
        "key_findings": ai_result.get("key_findings", []),
        "ai_mode": ai_result["mode"],
        "fallback_reason": fallback_reason,
      },
    )
    db.commit()
    db.refresh(report)
    if timeline_event is not None:
      db.refresh(timeline_event)
    logger.info(
      "Report persisted patient_id=%s report_id=%s timeline_event_id=%s",
      patient_id,
      report.id,
      timeline_event.id if timeline_event else None,
    )

    return {
      "report_id": report.id,
      "patient_id": report.patient_id,
      "classification": ai_result["classification"],
      "key_findings": ai_result["key_findings"],
      "summary": ai_result["summary"],
      "predicted_category": ai_result["predicted_category"],
      "plain_language_summary": ai_result["plain_language_summary"],
      "top_keywords": ai_result.get("top_keywords", []),
      "extracted_findings": ai_result.get("extracted_findings", []),
      "follow_up_recommendations": ai_result.get("follow_up_recommendations", []),
      "safety_flags": ai_result.get("safety_flags", []),
      "structured_data": ai_result.get("structured_data", {}),
      "mode": response_mode,
      "ai_mode": ai_result["mode"],
      "fallback_reason": fallback_reason,
      "timeline_event_id": timeline_event.id if timeline_event else None,
      "created_at": report.created_at,
    }


@lru_cache(maxsize=1)
def get_report_agent() -> ReportAgent:
  return ReportAgent()
