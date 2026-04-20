from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
import logging
from typing import Any

from sqlalchemy.orm import Session

from backend.config import get_settings
from backend.db import models
from backend.services.openai_service import get_ai_provider
from backend.services.rag_prompts import COPILOT_RAG_PROMPT_VERSION, PromptEvidenceItem
from backend.services.timeline_service import create_timeline_event
from backend.services.vector_service import get_vector_service


logger = logging.getLogger(__name__)
settings = get_settings()


class CopilotAgent:
  def __init__(self):
    self.ai = get_ai_provider()
    self.vector = get_vector_service()

  def _collect_patient_context(
    self,
    db: Session,
    patient_id: int | None,
  ) -> dict[str, Any] | None:
    if patient_id is None:
      return None

    patient = db.get(models.Patient, patient_id)
    if patient is None:
      return None

    recent_reports = (
      db.query(models.Report)
      .filter(models.Report.patient_id == patient_id)
      .order_by(models.Report.created_at.desc())
      .limit(3)
      .all()
    )
    recent_triages = (
      db.query(models.TriageSession)
      .filter(models.TriageSession.patient_id == patient_id)
      .order_by(models.TriageSession.created_at.desc())
      .limit(3)
      .all()
    )
    recent_events = (
      db.query(models.TimelineEvent)
      .filter(models.TimelineEvent.patient_id == patient_id)
      .order_by(models.TimelineEvent.timestamp.desc())
      .limit(5)
      .all()
    )

    return {
      "patient": patient,
      "alerts": patient.alerts or [],
      "tasks": patient.tasks or [],
      "recent_reports": recent_reports,
      "recent_triages": recent_triages,
      "recent_events": recent_events,
    }

  def _format_patient_context(self, context: dict[str, Any] | None) -> str | None:
    if context is None:
      return None

    patient: models.Patient = context["patient"]
    lines = [
      f"Patient: {patient.name}",
      f"MRN: {patient.mrn or 'N/A'}",
      f"Primary clinician: {patient.primary_clinician or 'Not listed'}",
      f"History summary: {patient.history_summary or 'None provided'}",
      f"Conditions: {', '.join(patient.conditions) if patient.conditions else 'None listed'}",
      f"Medications: {', '.join(patient.medications) if patient.medications else 'None listed'}",
    ]

    if context["alerts"]:
      lines.append("Active alerts:")
      lines.extend(
        f"- {alert.get('label')}: {alert.get('detail')}"
        for alert in context["alerts"]
      )

    if context["tasks"]:
      lines.append("Open tasks:")
      lines.extend(
        f"- {task.get('label')} ({task.get('status')})"
        for task in context["tasks"]
      )

    if context["recent_reports"]:
      lines.append("Recent reports:")
      lines.extend(
        (
          f"- {report.created_at.date()}: {report.classification or report.title or 'Report'}; "
          f"summary={report.summary or 'No summary available'}; "
          f"key_findings={', '.join(report.key_findings[:3]) if report.key_findings else 'None'}"
        )
        for report in context["recent_reports"]
      )

    if context["recent_triages"]:
      lines.append("Recent triage assessments:")
      lines.extend(
        (
          f"- {triage.created_at.date()}: risk={triage.risk_level}; "
          f"summary={triage.summary}; red_flags={', '.join(triage.red_flags[:3]) if triage.red_flags else 'None'}; "
          f"recommended_action={triage.recommended_action}"
        )
        for triage in context["recent_triages"]
      )

    if context["recent_events"]:
      lines.append("Recent timeline events:")
      lines.extend(
        f"- {event.timestamp.date()}: {event.title} ({event.event_type})"
        for event in context["recent_events"]
      )

    return "\n".join(lines)

  def _top_concerns(self, context: dict[str, Any] | None) -> list[str]:
    if context is None:
      return []

    concerns: list[str] = []
    for alert in context["alerts"]:
      label = alert.get("label")
      detail = alert.get("detail")
      if label:
        concerns.append(f"{label}: {detail}" if detail else str(label))

    for report in context["recent_reports"][:2]:
      if report.key_findings:
        concerns.extend(report.key_findings[:2])
      elif report.summary:
        concerns.append(report.summary)

    for triage in context["recent_triages"][:2]:
      if triage.red_flags:
        concerns.extend(triage.red_flags[:2])
      else:
        concerns.append(f"{triage.risk_level} risk triage: {triage.summary}")

    deduped = [item.strip() for item in concerns if item and item.strip()]
    return list(dict.fromkeys(deduped))[:5]

  def _next_steps(self, context: dict[str, Any] | None) -> list[str]:
    if context is None:
      return []

    steps: list[str] = []
    for task in context["tasks"]:
      label = task.get("label")
      status = task.get("status")
      if label:
        steps.append(f"{label} ({status})" if status else str(label))

    for triage in context["recent_triages"][:1]:
      steps.append(triage.recommended_action)

    for report in context["recent_reports"][:1]:
      recommendation = report.structured_data.get("recommendation")
      if isinstance(recommendation, str) and recommendation.strip():
        steps.append(recommendation.strip())

    return list(dict.fromkeys(step for step in steps if step))[:4]

  def _build_retrieval_query(
    self,
    message: str,
    context: dict[str, Any] | None,
  ) -> str:
    lowered = message.lower()
    summary_request = any(
      phrase in lowered
      for phrase in (
        "summarize",
        "summarise",
        "top risks",
        "patient context",
        "current context",
        "active concerns",
      )
    )
    if not summary_request:
      return message

    evidence_terms = self._top_concerns(context)
    if evidence_terms:
      return "; ".join(evidence_terms[:4])
    return message

  def _build_prompt_evidence_items(
    self,
    retrieval_results: list[dict[str, Any]],
  ) -> tuple[list[PromptEvidenceItem], dict[str, dict[str, Any]]]:
    items: list[PromptEvidenceItem] = []
    lookup: dict[str, dict[str, Any]] = {}
    for index, result in enumerate(retrieval_results, start=1):
      citation_id = f"E{index}"
      excerpt = str(result.get("text") or "").strip()
      item = PromptEvidenceItem(
        citation_id=citation_id,
        title=str(result.get("title") or "Untitled evidence"),
        excerpt=excerpt[:900],
        source=result.get("source"),
        url=result.get("url"),
        section=result.get("section"),
        page=result.get("page"),
        score=float(result.get("score")) if result.get("score") is not None else None,
      )
      items.append(item)
      lookup[citation_id] = {"chunk_id": str(result.get("id") or ""), **result}
    return items, lookup

  def _build_grounded_citations(
    self,
    citation_ids: list[str],
    evidence_lookup: dict[str, dict[str, Any]],
  ) -> list[dict[str, Any]]:
    citations: list[dict[str, Any]] = []
    for citation_id in citation_ids:
      result = evidence_lookup.get(citation_id)
      if result is None:
        continue
      citations.append(
        {
          "title": str(result.get("title") or "Untitled evidence"),
          "citation_id": citation_id,
          "source": result.get("source"),
          "url": result.get("url"),
          "section": result.get("section"),
          "page": result.get("page"),
          "chunk_id": result.get("chunk_id"),
          "snippet": str(result.get("text") or "")[:280],
          "score": result.get("score"),
        }
      )
    return citations

  def _build_rag_trace(
    self,
    *,
    retrieval_query: str,
    retrieval_outcome: dict[str, Any] | None,
    citations: list[dict[str, Any]],
    insufficient_evidence: bool,
  ) -> dict[str, Any]:
    base_trace = dict(retrieval_outcome or {})
    return {
      "prompt_version": COPILOT_RAG_PROMPT_VERSION,
      "retrieval_query": retrieval_query,
      "normalized_query": base_trace.get("normalized_query"),
      "retrieval_mode": base_trace.get("mode", "error"),
      "retrieval_ai_mode": base_trace.get("ai_mode"),
      "retrieval_fallback_reason": base_trace.get("fallback_reason"),
      "filters": base_trace.get("filters") or {},
      "retrieved_evidence": [
        {
          "citation_id": citation.get("citation_id"),
          "title": citation.get("title"),
          "source": citation.get("source"),
          "section": citation.get("section"),
          "page": citation.get("page"),
          "score": citation.get("score"),
        }
        for citation in citations
      ],
      "insufficient_evidence": insufficient_evidence,
    }

  def _build_grounded_reply(
    self,
    message: str,
    context: dict[str, Any] | None,
    *,
    retrieved_evidence: list[dict[str, Any]] | None = None,
    fallback_reason: str | None = None,
  ) -> dict[str, Any]:
    lowered = message.lower()
    citations = self._build_grounded_citations(
      [f"E{index}" for index, _item in enumerate(retrieved_evidence or [], start=1)],
      {
        f"E{index}": {"chunk_id": str(item.get("id") or ""), **item}
        for index, item in enumerate(retrieved_evidence or [], start=1)
      },
    )
    if context is None:
      return {
        "reply": (
          "No connected patient context is currently available. Select a patient or make sure the "
          "patient profile has loaded, then ask again for a grounded summary or risk review.\n\n"
          f"Question: {message}"
        ),
        "citations": citations,
        "mode": "heuristic",
        "fallback_reason": fallback_reason,
        "insufficient_evidence": True,
      }

    patient: models.Patient = context["patient"]
    report_lines = []
    for report in context["recent_reports"][:2]:
      report_lines.append(
        (
          f"- {report.created_at.date()}: {report.classification or report.title or 'Report'}; "
          f"{report.summary or 'No summary available'}"
        )
      )

    triage_lines = []
    for triage in context["recent_triages"][:2]:
      triage_lines.append(
        (
          f"- {triage.created_at.date()}: {triage.risk_level} risk; "
          f"{triage.summary}; recommended action: {triage.recommended_action}"
        )
      )

    top_concerns = self._top_concerns(context)
    next_steps = self._next_steps(context)
    summary_request = any(
      phrase in lowered
      for phrase in (
        "summarize",
        "summarise",
        "top risks",
        "patient context",
        "current context",
        "active concerns",
      )
    )

    if summary_request:
      parts = [
        f"Current patient context for {patient.name} (MRN {patient.mrn or 'N/A'}):",
        f"- History: {patient.history_summary or 'No history summary available.'}",
        f"- Conditions: {', '.join(patient.conditions) if patient.conditions else 'None listed'}",
        f"- Medications: {', '.join(patient.medications) if patient.medications else 'None listed'}",
      ]
      if report_lines:
        parts.append("Recent report findings:")
        parts.extend(report_lines)
      if triage_lines:
        parts.append("Recent triage history:")
        parts.extend(triage_lines)
      if top_concerns:
        parts.append("Top active concerns:")
        parts.extend(f"- {concern}" for concern in top_concerns)
      if next_steps:
        parts.append("Recommended follow-up checks:")
        parts.extend(f"- {step}" for step in next_steps)
      if retrieved_evidence:
        parts.append("Retrieved evidence to review:")
        parts.extend(
          f"- {item.get('title')} ({item.get('section') or item.get('source') or 'evidence source'})"
          for item in retrieved_evidence[:3]
        )
      parts.append(
        "Clinical decision support only. Verify findings and next steps with the treating clinician."
      )
      return {
        "reply": "\n".join(parts),
        "citations": citations,
        "mode": "heuristic",
        "fallback_reason": fallback_reason,
        "insufficient_evidence": not bool(retrieved_evidence),
      }

    parts = [
      f"Using the current chart context for {patient.name}, here is the most relevant guidance for your question:",
      f"- Question: {message}",
    ]
    if top_concerns:
      parts.append("Most relevant active concerns:")
      parts.extend(f"- {concern}" for concern in top_concerns)
    if next_steps:
      parts.append("Likely next checks or follow-up:")
      parts.extend(f"- {step}" for step in next_steps)
    if retrieved_evidence:
      parts.append("Most relevant retrieved evidence:")
      parts.extend(
        f"- {item.get('title')}: {str(item.get('text') or '')[:180].strip()}"
        for item in retrieved_evidence[:3]
      )
    else:
      parts.append("No supporting evidence passages were retrieved for this question.")
    parts.append(
      "Clinical decision support only. Confirm the recommendation against the live chart and clinician judgment."
    )
    return {
      "reply": "\n".join(parts),
      "citations": citations,
      "mode": "heuristic",
      "fallback_reason": fallback_reason,
      "insufficient_evidence": not bool(retrieved_evidence),
    }

  def chat(
    self,
    db: Session,
    *,
    message: str,
    patient_id: int | None = None,
    conversation_id: int | None = None,
  ) -> dict[str, object]:
    conversation = None
    if conversation_id is not None:
      conversation = db.get(models.CopilotConversation, conversation_id)

    effective_patient_id = patient_id or (conversation.patient_id if conversation else None)
    if conversation is None:
      conversation = models.CopilotConversation(
        patient_id=effective_patient_id,
        title=message[:80],
      )
      db.add(conversation)
      db.flush()

    db.add(
      models.CopilotMessage(
        conversation_id=conversation.id,
        patient_id=effective_patient_id,
        role="user",
        content=message,
      )
    )
    db.flush()

    context_data = self._collect_patient_context(db, effective_patient_id)
    context_text = self._format_patient_context(context_data)
    retrieval_query = self._build_retrieval_query(message, context_data)
    # Retrieve chunk-level evidence so the model can cite exact retrieved passages.
    retrieval_outcome = self.vector.search(
      db,
      retrieval_query,
      top_k=settings.evidence_copilot_top_k,
      dedupe_by_document=False,
    )
    prompt_evidence_items, evidence_lookup = self._build_prompt_evidence_items(
      retrieval_outcome.results,
    )
    reply_payload = self.ai.chat(
      message,
      context=context_text,
      evidence_items=prompt_evidence_items,
    )

    if reply_payload["mode"] != "openai":
      fallback_reason = reply_payload.get("fallback_reason") or "unknown_error"
      reply_payload = self._build_grounded_reply(
        message,
        context_data,
        retrieved_evidence=retrieval_outcome.results,
        fallback_reason=fallback_reason,
      )
      response_mode = "fallback"
      ai_mode = "heuristic"
      citations = reply_payload.get("citations", [])
      insufficient_evidence = bool(reply_payload.get("insufficient_evidence", True))
    else:
      valid_citation_ids = [
        citation_id
        for citation_id in reply_payload.get("citation_ids", [])
        if citation_id in evidence_lookup
      ]
      insufficient_evidence = bool(
        reply_payload.get("insufficient_evidence", not bool(prompt_evidence_items))
      )
      if prompt_evidence_items and not valid_citation_ids and not insufficient_evidence:
        fallback_reason = "openai_bad_response"
        reply_payload = self._build_grounded_reply(
          message,
          context_data,
          retrieved_evidence=retrieval_outcome.results,
          fallback_reason=fallback_reason,
        )
        response_mode = "fallback"
        ai_mode = "heuristic"
        citations = reply_payload.get("citations", [])
        insufficient_evidence = bool(reply_payload.get("insufficient_evidence", True))
      else:
        citations = self._build_grounded_citations(valid_citation_ids, evidence_lookup)
        response_mode = "real"
        ai_mode = "openai"
        fallback_reason = None
    rag_trace = self._build_rag_trace(
      retrieval_query=retrieval_query,
      retrieval_outcome=retrieval_outcome.trace,
      citations=citations,
      insufficient_evidence=insufficient_evidence,
    )

    logger.info(
      "Copilot response generated patient_id=%s conversation_id=%s mode=%s ai_mode=%s fallback_reason=%s context_used=%s retrieved_chunks=%s insufficient_evidence=%s",
      effective_patient_id,
      conversation.id,
      response_mode,
      ai_mode,
      fallback_reason,
      context_data is not None,
      len(retrieval_outcome.results),
      insufficient_evidence,
    )

    reply_message = models.CopilotMessage(
      conversation_id=conversation.id,
      patient_id=effective_patient_id,
      role="assistant",
      content=reply_payload["reply"],
      citations=citations,
      message_metadata={
        "mode": response_mode,
        "ai_mode": ai_mode,
        "fallback_reason": fallback_reason,
        "context_used": context_data is not None,
        "insufficient_evidence": insufficient_evidence,
        "rag_trace": rag_trace,
      },
    )
    db.add(reply_message)
    db.flush()
    conversation.updated_at = datetime.now(timezone.utc)

    timeline_event = create_timeline_event(
      db,
      patient_id=effective_patient_id,
      event_type="copilot_interaction",
      title="Copilot interaction",
      summary=message[:200],
      metadata={"conversation_id": conversation.id},
    )

    db.commit()
    db.refresh(conversation)
    db.refresh(reply_message)
    if timeline_event is not None:
      db.refresh(timeline_event)

    return {
      "conversation_id": conversation.id,
      "patient_id": effective_patient_id,
      "reply": reply_message.content,
      "message_id": reply_message.id,
      "citations": citations,
      "mode": response_mode,
      "ai_mode": ai_mode,
      "fallback_reason": fallback_reason,
      "context_used": context_data is not None,
      "insufficient_evidence": insufficient_evidence,
      "rag_trace": rag_trace,
      "timeline_event_id": timeline_event.id if timeline_event else None,
    }


@lru_cache(maxsize=1)
def get_copilot_agent() -> CopilotAgent:
  return CopilotAgent()
