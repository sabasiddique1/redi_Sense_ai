from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from statistics import median
from typing import Any

from sqlalchemy.orm import Session

from backend.db import models

RISK_LEVELS: tuple[str, ...] = ("Low", "Moderate", "High", "Critical")
HIGH_RISK_LEVELS = {"High", "Critical"}
QUEUE_LIMIT = 8
ACTIVITY_LIMIT = 8
ALERT_LIMIT = 5
RISK_WINDOW_DAYS = 7
TREND_DAYS = 7
ALERT_SLA_MINUTES = 30
HOURLY_TARGET_PER_HOUR = 14
HOURLY_START_HOUR = 6
MODALITY_BUCKETS = 4


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


def _patient_label(patient: models.Patient | None, patient_id: int | None) -> tuple[str, str, str | None]:
  if patient is None:
    return ("Unassigned", f"Patient {patient_id}" if patient_id else "No patient", None)
  identifier = f"MRN {patient.mrn}" if patient.mrn else f"Patient {patient.id}"
  return (patient.name, identifier, patient.mrn)


def _daily_counts(timestamps: list[datetime], day_starts: list[datetime]) -> list[int]:
  counts = [0] * len(day_starts)
  for ts in timestamps:
    for index in range(len(day_starts) - 1, -1, -1):
      if ts >= day_starts[index]:
        counts[index] += 1
        break
  return counts


def _delta(current: float, previous: float, unit: str = "", suffix: str = "") -> dict[str, Any] | None:
  if previous <= 0:
    return None
  change = current - previous
  if abs(change) < 1e-9:
    return {"direction": "flat", "label": "no change"}
  pct = round(100 * change / previous)
  return {
    "direction": "up" if change > 0 else "down",
    "label": f"{'+' if change > 0 else ''}{pct}%{suffix}" if unit == "%" else f"{'+' if change > 0 else ''}{round(change, 1)}{unit}",
  }


def _modality_label(report: models.Report) -> str:
  raw = (report.modality or "").strip()
  if not raw:
    raw = (report.classification or report.title or "").strip()
  first = raw.split()[0] if raw else "Other"
  key = first.upper().strip(",.")
  aliases = {"CXR": "X-ray", "XRAY": "X-ray", "X-RAY": "X-ray", "RADIOGRAPH": "X-ray", "CHEST": "X-ray", "ULTRASOUND": "US"}
  return aliases.get(key, key if len(key) <= 5 else raw.title()) or "Other"


def build_dashboard_summary(db: Session) -> dict[str, Any]:
  now = _now()
  today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
  window_start = now - timedelta(days=RISK_WINDOW_DAYS)
  trend_start = today_start - timedelta(days=TREND_DAYS - 1)
  previous_start = trend_start - timedelta(days=TREND_DAYS)
  day_starts = [trend_start + timedelta(days=i) for i in range(TREND_DAYS)]
  previous_day_starts = [previous_start + timedelta(days=i) for i in range(TREND_DAYS)]

  patients: list[models.Patient] = db.query(models.Patient).all()
  patients_by_id = {patient.id: patient for patient in patients}

  total_reports = db.query(models.Report).count()
  reports_two_weeks: list[models.Report] = (
    db.query(models.Report).filter(models.Report.created_at >= previous_start).all()
  )
  reports_today = [r for r in reports_two_weeks if (_as_utc(r.created_at) or now) >= today_start]
  recent_reports: list[models.Report] = (
    db.query(models.Report)
    .order_by(models.Report.created_at.desc())
    .limit(QUEUE_LIMIT)
    .all()
  )

  triage_two_weeks: list[models.TriageSession] = (
    db.query(models.TriageSession)
    .filter(models.TriageSession.created_at >= previous_start)
    .order_by(models.TriageSession.created_at.desc())
    .all()
  )
  recent_triage = [s for s in triage_two_weeks if (_as_utc(s.created_at) or now) >= window_start]
  total_triage = db.query(models.TriageSession).count()

  recent_events: list[models.TimelineEvent] = (
    db.query(models.TimelineEvent)
    .order_by(models.TimelineEvent.timestamp.desc())
    .limit(ACTIVITY_LIMIT)
    .all()
  )

  assistant_messages: list[models.CopilotMessage] = [
    m for m in db.query(models.CopilotMessage).filter(models.CopilotMessage.created_at >= previous_start).all()
    if m.role == "assistant"
  ]

  evidence_documents = db.query(models.EvidenceDocument).count()
  evidence_chunks = db.query(models.EvidenceChunk).count()

  # ---- metrics with 7-day series and deltas ----
  report_ts = [_as_utc(r.created_at) or now for r in reports_two_weeks]
  reports_series = _daily_counts(report_ts, day_starts)
  reports_prev = _daily_counts(report_ts, previous_day_starts)
  reports_avg = sum(reports_series) / TREND_DAYS
  prev_avg = sum(reports_prev) / TREND_DAYS

  high_ts = [_as_utc(s.created_at) or now for s in triage_two_weeks if _normalize_risk(s.risk_level) in HIGH_RISK_LEVELS]
  high_series = _daily_counts(high_ts, day_starts)
  high_prev = _daily_counts(high_ts, previous_day_starts)
  risk_counts = Counter(_normalize_risk(session.risk_level) for session in recent_triage)
  high_risk_count = sum(risk_counts[level] for level in HIGH_RISK_LEVELS)
  critical_count = risk_counts["Critical"]

  cited = [m for m in assistant_messages if m.citations]
  cited_ts = [_as_utc(m.created_at) or now for m in cited]
  answers_ts = [_as_utc(m.created_at) or now for m in assistant_messages]
  cited_series_num = _daily_counts(cited_ts, day_starts)
  answers_series = _daily_counts(answers_ts, day_starts)
  cited_series = [round(100 * c / a) if a else 0 for c, a in zip(cited_series_num, answers_series)]
  cited_window = [m for m in assistant_messages if (_as_utc(m.created_at) or now) >= trend_start]
  cited_pct = round(100 * sum(1 for m in cited_window if m.citations) / len(cited_window)) if cited_window else None
  prev_window = [m for m in assistant_messages if (_as_utc(m.created_at) or now) < trend_start]
  prev_pct = round(100 * sum(1 for m in prev_window if m.citations) / len(prev_window)) if prev_window else None

  patients_with_alerts = sum(1 for patient in patients if patient.alerts)

  metrics = [
    {
      "id": "reports-today",
      "label": "Reports today",
      "value": str(len(reports_today)),
      "unit": None,
      "trend": "up" if len(reports_today) > reports_avg else ("down" if len(reports_today) < reports_avg else "neutral"),
      "trend_label": f"vs. 7-day avg {reports_avg:.0f}",
      "delta": _delta(len(reports_today), reports_avg, "%"),
      "series": reports_series,
      "footnote": f"{total_reports} on record",
      "pill": "AI-assisted",
      "secondary": None,
    },
    {
      "id": "high-risk",
      "label": "High / Critical risk",
      "value": str(high_risk_count),
      "unit": None,
      "trend": "down" if high_risk_count > 0 else "neutral",
      "trend_label": f"{len(recent_triage)} triage sessions in {RISK_WINDOW_DAYS}d",
      "delta": _delta(sum(high_series), sum(high_prev), "%"),
      "series": high_series,
      "footnote": f"{round(100 * high_risk_count / len(recent_triage))}% of the {RISK_WINDOW_DAYS}-day triage queue" if recent_triage else "No triage sessions in window",
      "pill": "Safety",
      "secondary": {"value": str(critical_count), "label": "critical", "tone": "Critical"} if critical_count else None,
    },
    {
      # TODO(backend): needs triage_sessions.duration_seconds (start→verdict) to compute a median.
      "id": "triage-time",
      "label": "Median triage time",
      "value": None,
      "unit": "min",
      "trend": "neutral",
      "trend_label": "Not available",
      "delta": None,
      "series": None,
      "footnote": "Not available — needs triage duration",
      "pill": "Efficiency",
      "secondary": None,
    },
    {
      "id": "evidence-linked",
      "label": "Guideline-linked",
      "value": str(cited_pct) if cited_pct is not None else None,
      "unit": "%",
      "trend": "up" if (cited_pct or 0) >= 80 else "neutral",
      "trend_label": f"{evidence_documents} documents · {evidence_chunks} chunks indexed",
      "delta": _delta(cited_pct, prev_pct, "%", "pt") if cited_pct is not None and prev_pct is not None else None,
      "series": cited_series if cited_window else None,
      "footnote": "of Copilot answers cite ≥1 source" if cited_pct is not None else "Not available — no Copilot answers in the last 7 days",
      "pill": "Evidence",
      "secondary": None,
    },
  ]

  # ---- hero: today's reports by derived risk, modality mix, hourly throughput ----
  today_risk = Counter(_report_risk(r) for r in reports_today)
  reports_by_risk = [{"label": level, "value": today_risk[level]} for level in RISK_LEVELS]
  high_share_today = round(100 * (today_risk["High"] + today_risk["Critical"]) / len(reports_today)) if reports_today else 0
  week_reports = [r for r in reports_two_weeks if (_as_utc(r.created_at) or now) >= trend_start]
  week_risk = Counter(_report_risk(r) for r in week_reports)
  week_share = round(100 * (week_risk["High"] + week_risk["Critical"]) / len(week_reports)) if week_reports else 0
  if reports_today:
    risk_caption = (
      f"{high_share_today}% of today's reports are High or Critical — "
      f"{'above' if high_share_today > week_share else 'at or below'} the {week_share}% weekly baseline."
    )
  else:
    risk_caption = "No reports analyzed today yet."

  modality_counter = Counter(_modality_label(r) for r in week_reports)
  top = modality_counter.most_common(MODALITY_BUCKETS)
  other = sum(modality_counter.values()) - sum(v for _, v in top)
  modality_mix = [{"label": label, "value": value} for label, value in top]
  if other > 0:
    modality_mix.append({"label": "Other", "value": other})

  hourly: list[dict[str, Any]] = []
  earliest_today = min([(_as_utc(r.created_at) or now).hour for r in reports_today] or [now.hour])
  first_hour = min(HOURLY_START_HOUR, now.hour, earliest_today)
  for hour in range(first_hour, now.hour + 1):
    bucket_start = today_start + timedelta(hours=hour)
    bucket_end = bucket_start + timedelta(hours=1)
    count = sum(1 for r in reports_today if bucket_start <= (_as_utc(r.created_at) or now) < bucket_end)
    hourly.append({"label": f"{hour:02d}:00", "value": count})
  hourly[-1]["label"] = now.strftime("%H:%M") if hourly else "now"
  above_target = [h for h in hourly if h["value"] >= HOURLY_TARGET_PER_HOUR]
  hourly_caption = (
    f"Throughput cleared the {HOURLY_TARGET_PER_HOUR}/hr target in {len(above_target)} of {len(hourly)} hours today."
    if reports_today
    else "No reports analyzed today yet."
  )

  # ---- queue ----
  reports_queue = []
  for report in recent_reports:
    name, identifier, mrn = _patient_label(patients_by_id.get(report.patient_id), report.patient_id)
    created = _as_utc(report.created_at)
    reports_queue.append(
      {
        "id": str(report.id),
        "patient_name": name,
        "patient_id": identifier,
        "mrn": mrn,
        "modality": report.title or report.classification or report.modality or "Report",
        "summary": report.summary or "No summary available.",
        "risk": _report_risk(report),
        # TODO(backend): reports.confidence — the analyzer does not score confidence yet.
        "confidence": None,
        "received_at": created,
        "minutes_in_queue": int((now - created).total_seconds() // 60) if created else None,
      }
    )

  # ---- alerts with SLA clock ----
  urgent_alerts: list[dict[str, Any]] = []
  for session in recent_triage:
    risk = _normalize_risk(session.risk_level)
    if risk not in HIGH_RISK_LEVELS:
      continue
    name, _, _ = _patient_label(patients_by_id.get(session.patient_id), session.patient_id)
    created = _as_utc(session.created_at)
    urgent_alerts.append(
      {
        "id": f"triage-{session.id}",
        "label": f"{risk} risk triage",
        "patient_name": name,
        "detail": session.recommended_action or session.summary or "",
        "severity": risk,
        "elapsed_minutes": int((now - created).total_seconds() // 60) if created else None,
        "sla_minutes": ALERT_SLA_MINUTES,
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
          # TODO(backend): patient alerts carry no timestamp, so no SLA clock.
          "elapsed_minutes": None,
          "sla_minutes": ALERT_SLA_MINUTES,
        }
      )
  urgent_alerts = urgent_alerts[:ALERT_LIMIT]

  # ---- insight ----
  record_count = total_reports + total_triage
  if recent_triage:
    high_share = round(100 * high_risk_count / len(recent_triage))
    prev_high = sum(high_prev)
    trend_note = (
      f" High-risk sessions are {'up' if sum(high_series) > prev_high else 'down' if sum(high_series) < prev_high else 'level'} vs. the previous {TREND_DAYS} days."
      if prev_high or sum(high_series)
      else ""
    )
    insight = {
      "id": "insight-risk-mix",
      "title": f"{high_share}% of triage sessions in the last {RISK_WINDOW_DAYS} days were high or critical",
      "summary": (
        f"{len(recent_triage)} triage sessions and {len(reports_today)} reports were recorded in the window. "
        f"Risk mix: {', '.join(f'{level} {risk_counts[level]}' for level in RISK_LEVELS)}.{trend_note} "
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
      "patient_name": patients_by_id[event.patient_id].name if event.patient_id in patients_by_id else None,
    }
    for event in recent_events
  ]

  # median is only meaningful once durations exist; kept here so the field is discoverable
  _ = median

  return {
    "generated_at": now,
    "risk_window_days": RISK_WINDOW_DAYS,
    "trend_days": TREND_DAYS,
    "metrics": metrics,
    "reports_by_risk": reports_by_risk,
    "reports_by_risk_caption": risk_caption,
    "modality_mix": modality_mix,
    "modality_total": len(week_reports),
    "hourly": hourly,
    "hourly_target": HOURLY_TARGET_PER_HOUR,
    "hourly_caption": hourly_caption,
    "reports_queue": reports_queue,
    "reports_total": total_reports,
    "urgent_alerts": urgent_alerts,
    "ai_insight": insight,
    "risk_distribution": risk_distribution,
    "recent_activity": recent_activity,
    "mode": "real",
  }
