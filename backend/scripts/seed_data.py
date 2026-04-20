from __future__ import annotations

from datetime import datetime, timezone

from backend.db import models
from backend.db.database import SessionLocal


UTC = timezone.utc


def upsert_patient() -> models.Patient:
  with SessionLocal() as db:
    patient = db.get(models.Patient, 1)
    if patient is None:
      patient = models.Patient(id=1, name="Lien Nguyen")
      db.add(patient)
      db.flush()

    patient.mrn = "184920"
    patient.dob = datetime(1968, 3, 15, tzinfo=UTC).date()
    patient.gender = "Female"
    patient.primary_clinician = "Dr. A. Hernandez"
    patient.history_summary = (
      "62-year-old patient with hypertension and type 2 diabetes. "
      "Right upper lobe pulmonary nodule under surveillance."
    )
    patient.ai_notes = (
      "AI summary: interval enlargement of the right upper lobe nodule with "
      "spiculation. Recommend PET-CT and thoracic surgery consultation."
    )
    patient.allergies = ["Latex", "Penicillin"]
    patient.conditions = ["Hypertension", "Type 2 diabetes mellitus"]
    patient.medications = [
      "Lisinopril 10mg daily",
      "Metformin 500mg BID",
      "Atorvastatin 20mg nightly",
    ]
    patient.alerts = [
      {
        "id": "1",
        "label": "Incidental PE risk",
        "detail": "Segmental PE not in dictated impression.",
      }
    ]
    patient.tasks = [
      {"id": "1", "label": "Order PET-CT", "status": "In progress"},
      {"id": "2", "label": "Thoracic surgery referral", "status": "Pending"},
      {"id": "3", "label": "Patient discussion", "status": "Done"},
    ]
    patient.profile_metadata = {
      "last_lab": "2026-03-01",
      "asa_classification": "II",
      "icu_need": "No",
    }

    db.commit()
    db.refresh(patient)
    return patient


def upsert_reports(patient_id: int) -> list[models.Report]:
  report_specs = [
    {
      "title": "CT chest w/ contrast",
      "created_at": datetime(2026, 3, 8, 8, 12, tzinfo=UTC),
      "classification": "CT Chest",
      "summary": "Interval enlargement of a right upper lobe nodule with suspicious morphology.",
      "key_findings": [
        "Right upper lobe nodule increased from 8mm to 12mm.",
        "Subtle spiculation and increased density are present.",
        "PET-CT and thoracic surgery consultation were recommended.",
      ],
      "structured_data": {
        "modality": "CT",
        "body_part": "Chest",
        "recommendation": "PET-CT and thoracic surgery consult",
      },
      "analysis_source": "seed",
      "report_text": (
        "CT CHEST WITH CONTRAST\n\nFindings: Interval enlargement of the previously "
        "noted right upper lobe nodule, now 12mm with subtle spiculation."
      ),
    },
    {
      "title": "CXR follow-up",
      "created_at": datetime(2026, 2, 20, 9, 0, tzinfo=UTC),
      "classification": "Chest radiograph",
      "summary": "No interval change. Pulmonary nodule remained stable at 8mm on prior imaging.",
      "key_findings": [
        "Stable right upper lobe nodule at 8mm.",
        "No pleural effusion or acute cardiopulmonary process.",
      ],
      "structured_data": {
        "modality": "CXR",
        "body_part": "Chest",
      },
      "analysis_source": "seed",
      "report_text": "CXR follow-up showing stable right upper lobe nodule.",
    },
  ]

  saved_reports: list[models.Report] = []
  with SessionLocal() as db:
    for spec in report_specs:
      report = (
        db.query(models.Report)
        .filter(models.Report.patient_id == patient_id, models.Report.title == spec["title"])
        .one_or_none()
      )
      if report is None:
        report = models.Report(patient_id=patient_id, title=spec["title"], report_text="")
        db.add(report)
        db.flush()

      report.modality = spec["structured_data"].get("modality")
      report.classification = spec["classification"]
      report.summary = spec["summary"]
      report.key_findings = spec["key_findings"]
      report.structured_data = spec["structured_data"]
      report.analysis_source = spec["analysis_source"]
      report.report_text = spec["report_text"]
      report.created_at = spec["created_at"]
      saved_reports.append(report)

    db.commit()
    for report in saved_reports:
      db.refresh(report)
    return saved_reports


def upsert_triage(patient_id: int) -> models.TriageSession:
  with SessionLocal() as db:
    session = (
      db.query(models.TriageSession)
      .filter(
        models.TriageSession.patient_id == patient_id,
        models.TriageSession.symptoms == "Intermittent dry cough x 2 weeks. No fever, no hemoptysis.",
      )
      .one_or_none()
    )
    if session is None:
      session = models.TriageSession(
        patient_id=patient_id,
        symptoms="Intermittent dry cough x 2 weeks. No fever, no hemoptysis.",
        risk_level="Moderate",
        red_flags=["Known pulmonary nodule under active surveillance"],
        recommended_action="Schedule expedited pulmonology follow-up.",
        summary="Symptoms are stable but should be correlated with the enlarging lung nodule.",
        differential=["Nodule-related irritation", "Post-viral cough", "Reactive airway disease"],
        analysis_source="seed",
        created_at=datetime(2026, 2, 28, 10, 30, tzinfo=UTC),
      )
      db.add(session)
    else:
      session.risk_level = "Moderate"
      session.red_flags = ["Known pulmonary nodule under active surveillance"]
      session.recommended_action = "Schedule expedited pulmonology follow-up."
      session.summary = "Symptoms are stable but should be correlated with the enlarging lung nodule."
      session.differential = ["Nodule-related irritation", "Post-viral cough", "Reactive airway disease"]
      session.analysis_source = "seed"
      session.created_at = datetime(2026, 2, 28, 10, 30, tzinfo=UTC)

    db.commit()
    db.refresh(session)
    return session


def upsert_timeline_events(patient_id: int, report_ids: list[int], triage_session_id: int) -> None:
  event_specs = [
    {
      "event_type": "report_uploaded",
      "title": "CT chest w/ contrast uploaded",
      "summary": "Follow-up right upper lobe nodule with interval growth and suspicious features.",
      "timestamp": datetime(2026, 3, 8, 8, 12, tzinfo=UTC),
      "event_metadata": {
        "report_id": report_ids[0],
        "findings": [
          "Interval enlargement from 8mm to 12mm",
          "Spiculation and increased density",
          "PET-CT and thoracic surgery recommended",
        ],
      },
    },
    {
      "event_type": "medication_change",
      "title": "Medication change",
      "summary": "Atorvastatin increased to 20mg nightly.",
      "timestamp": datetime(2026, 3, 1, 14, 0, tzinfo=UTC),
      "event_metadata": {},
    },
    {
      "event_type": "triage_completed",
      "title": "Symptom check - cough",
      "summary": "Intermittent dry cough for two weeks without fever or hemoptysis.",
      "timestamp": datetime(2026, 2, 28, 10, 30, tzinfo=UTC),
      "event_metadata": {"triage_session_id": triage_session_id},
    },
    {
      "event_type": "report_uploaded",
      "title": "CXR follow-up reviewed",
      "summary": "Prior chest radiograph was stable with no interval change.",
      "timestamp": datetime(2026, 2, 20, 9, 0, tzinfo=UTC),
      "event_metadata": {"report_id": report_ids[1]},
    },
  ]

  with SessionLocal() as db:
    for spec in event_specs:
      event = (
        db.query(models.TimelineEvent)
        .filter(
          models.TimelineEvent.patient_id == patient_id,
          models.TimelineEvent.event_type == spec["event_type"],
          models.TimelineEvent.title == spec["title"],
        )
        .one_or_none()
      )
      if event is None:
        event = models.TimelineEvent(
          patient_id=patient_id,
          event_type=spec["event_type"],
          title=spec["title"],
          summary=spec["summary"],
          event_metadata=spec["event_metadata"],
          timestamp=spec["timestamp"],
        )
        db.add(event)
      else:
        event.summary = spec["summary"]
        event.event_metadata = spec["event_metadata"]
        event.timestamp = spec["timestamp"]

    db.commit()


def main() -> None:
  patient = upsert_patient()
  reports = upsert_reports(patient.id)
  triage_session = upsert_triage(patient.id)
  upsert_timeline_events(patient.id, [report.id for report in reports], triage_session.id)
  print(
    f"Seeded patient={patient.id} reports={len(reports)} triage_session={triage_session.id}"
  )


if __name__ == "__main__":
  main()
