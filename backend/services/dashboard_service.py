from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from backend.db import models

RISK_LEVELS: tuple[str, ...] = ("Low", "Moderate", "High", "Critical")
HIGH_RISK_LEVELS = {"High", "Critical"}
QUEUE_LIMIT = 6
ACTIVITY_LIMIT = 6
ALERT_LIMIT = 5
RISK_WINDOW_DAYS = 7


def _now() -> datetime:
  return datetime.now(timezone.utc)


def _as_utc(value: datetime | None) -> datetime | None:
  if value is None:
    return None
  if value.tzinfo is None:
    return value.replace(tzinfo=timezone.utc)
  return value.astimezone(timezone.utc)


def _normalize_risk(value: str | None) -> str:
  candidate = (value or "").strip().title()
  return candidate if candidate in RISK_LEVELS else "Low"


def _report_risk(report: models.Report) -> str:
  """Derive a queue risk from the report's persisted safety flags.

  Reports carry no risk column; the analyzer stores machine-readable
  ``safety_flags`` inside ``structured_data``. Presence of any flag is at least
  Moderate; flags that name urgency escalate further.
  """
  structured = report.structured_data or {}
  flags = [str(flag).lower() for flag in structured.get("safety_flags") or []]
  if not flags:
    return "Low"
  joined = " ".join(flags)
  if any(token in joined for token in ("critical", "emergen", "immediate")):
    return "Critical"
  if any(token in joined for token in ("urgent", "suspicious", "escalat", "discrepan")):
    return "High"
  return "Moderate"


def _patient_label(patient: models.Patient | None, patient_id: int | None) -> tuple[str, str]:
  if patient is None:
    return ("Unassigned", f"Patient {patient_id}" if patient_id else "No patient")
  identifier = f"MRN {patient.mrn}" if patient.mrn else f"Patient {patient.id}"
  return (patient.name, identifier)


def build_dashboard_summary(db: Session) -> dict[str, Any]:
  now = _now()
  today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
  window_start = now - timedelta(days=RISK_WINDOW_DAYS)

  patients: list[models.Patient] = db.query(models.Patient).all()
  patients_by_id = {patient.id: patient for patient in patients}

  total_reports = db.query(models.Report).count()
  reports_today = (
    db.query(models.Report).filter(models.Report.created_at >= today_start).count()
  )
  recent_reports: list[models.Report] = (
    db.query(models.Report)
    .order_by(models.Report.created_at.desc())
    .limit(QUEUE_LIMIT)
    .all()
  )

  recent_triage: list[models.TriageSession] = (
    db.query(models.TriageSession)
    .filter(models.TriageSession.created_at >= window_start)
    .order_by(models.TriageSession.created_at.desc())
    .all()
  )
  total_triage = db.query(models.TriageSession).count()

  recent_events: list[models.TimelineEvent] = (
    db.query(models.TimelineEvent)
    .order_by(models.TimelineEvent.timestamp.desc())
    .limit(ACTIVITY_LIMIT)
    .all()
  )

  evidence_documents = db.query(models.EvidenceDocument).count()
  evidence_chunks = db.query(models.EvidenceChunk).count()

  risk_counts = Counter(_normalize_risk(session.risk_level) for session in recent_triage)
  high_risk_count = sum(risk_counts[level] for level in HIGH_RISK_LEVELS)
  patients_with_alerts = sum(1 for patient in patients if patient.alerts)

  metrics = [
    {
      "id": "reports-today",
      "label": "Reports analyzed today",
      "value": str(reports_today),
      "trend": "up" if reports_today > 0 else "neutral",
      "trend_label": f"{total_reports} on record",
      "pill": "AI-assisted",
    },
    {
      "id": "high-risk",
      "label": f"High / critical triage ({RISK_WINDOW_DAYS}d)",
      "value": str(high_risk_count),
      "trend": "down" if high_risk_count > 0 else "neutral",
      "trend_label": f"{len(recent_triage)} triage sessions in window",
      "pill": "Safety",
    },
    {
      "id": "active-patients",
      "label": "Patients on record",
      "value": str(len(patients)),
      "trend": "neutral",
      "trend_label": f"{patients_with_alerts} with open alerts",
      "pill": "Cohort",
    },
    {
      "id": "evidence-linked",
      "label": "Evidence documents indexed",
      "value": str(evidence_documents),
      "trend": "up" if evidence_chunks > 0 else "neutral",
      "trend_label": f"{evidence_chunks} searchable chunks",
      "pill": "Evidence",
    },
  ]

  reports_queue = []
  for report in recent_reports:
    name, identifier = _patient_label(patients_by_id.get(report.patient_id), report.patient_id)
    reports_queue.append(
      {
        "id": str(report.id),
        "patient_name": name,
        "patient_id": identifier,
        "modality": report.title or report.classification or report.modality or "Report",
        "summary": report.summary or "No summary available.",
        "risk": _report_risk(report),
        "received_at": _as_utc(report.created_at),
      }
    )

  urgent_alerts: list[dict[str, Any]] = []
  for session in recent_triage:
    risk = _normalize_risk(session.risk_level)
    if risk not in HIGH_RISK_LEVELS:
      continue
    name, _ = _patient_label(patients_by_id.get(session.patient_id), session.patient_id)
    urgent_alerts.append(
      {
        "id": f"triage-{session.id}",
        "label": f"{risk} risk triage",
        "patient_name": name,
        "detail": session.recommended_action or session.summary or "",
        "severity": risk,
      }
    )
  for patient in patients:
    for alert in patient.alerts or []:
      urgent_alerts.append(
        {
          "id": f"patient-{patient.id}-{alert.get('id', len(urgent_alerts))}",
          "label": str(alert.get("label", "Patient alert")),
          "patient_name": patient.name,
          "detail": str(alert.get("detail", "")),
          "severity": "High",
        }
      )
  urgent_alerts = urgent_alerts[:ALERT_LIMIT]

  record_count = total_reports + total_triage
  if recent_triage:
    high_share = round(100 * high_risk_count / len(recent_triage))
    insight = {
      "id": "insight-risk-mix",
      "title": f"{high_share}% of triage sessions in the last {RISK_WINDOW_DAYS} days were high or critical",
      "summary": (
        f"{len(recent_triage)} triage sessions and {reports_today} reports were recorded in the window. "
        f"Risk mix: {', '.join(f'{level} {risk_counts[level]}' for level in RISK_LEVELS)}. "
        f"Computed deterministically from {record_count} persisted records."
      ),
      "confidence": 100,
      "record_count": record_count,
    }
  elif record_count:
    insight = {
      "id": "insight-no-triage",
      "title": f"No triage sessions in the last {RISK_WINDOW_DAYS} days",
      "summary": (
        f"{total_reports} reports and {total_triage} triage sessions exist on record. "
        "Run a triage from the Symptom Triage page to populate the risk distribution."
      ),
      "confidence": 100,
      "record_count": record_count,
    }
  else:
    insight = {
      "id": "insight-empty",
      "title": "No activity recorded yet",
      "summary": "Upload a report or run a triage to start populating the dashboard.",
      "confidence": 0,
      "record_count": 0,
    }

  risk_distribution = [{"label": level, "value": risk_counts[level]} for level in RISK_LEVELS]

  recent_activity = [
    {
      "id": str(event.id),
      "timestamp": _as_utc(event.timestamp),
      "label": event.title,
      "detail": event.summary,
      "event_type": event.event_type,
      "patient_id": event.patient_id,
    }
    for event in recent_events
  ]

  return {
    "generated_at": now,
    "risk_window_days": RISK_WINDOW_DAYS,
    "metrics": metrics,
    "reports_queue": reports_queue,
    "urgent_alerts": urgent_alerts,
    "ai_insight": insight,
    "risk_distribution": risk_distribution,
    "recent_activity": recent_activity,
    "mode": "real",
  }
