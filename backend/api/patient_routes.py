from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db import models
from backend.db.schemas import (
  PatientListItem,
  PatientProfileResponse,
  ReportListItem,
  TimelineEventResponse,
)


router = APIRouter(prefix="/api/patient", tags=["patient"])


@router.get("", response_model=list[PatientListItem])
def list_patients(db: Session = Depends(get_db)):
  patients = db.query(models.Patient).order_by(models.Patient.id.asc()).all()
  return [PatientListItem.model_validate(patient) for patient in patients]


@router.get("/{patient_id}", response_model=PatientProfileResponse)
def get_patient(patient_id: int, db: Session = Depends(get_db)):
  patient = db.get(models.Patient, patient_id)
  if not patient:
    raise HTTPException(status_code=404, detail="Patient not found")
  recent_reports = [
    ReportListItem.model_validate(report)
    for report in patient.reports[:5]
  ]
  return PatientProfileResponse(
    id=patient.id,
    mrn=patient.mrn,
    name=patient.name,
    dob=patient.dob,
    gender=patient.gender,
    primary_clinician=patient.primary_clinician,
    allergies=patient.allergies or [],
    conditions=patient.conditions or [],
    medications=patient.medications or [],
    history_summary=patient.history_summary,
    ai_notes=patient.ai_notes,
    profile_metadata=patient.profile_metadata or {},
    alerts=patient.alerts or [],
    tasks=patient.tasks or [],
    recent_reports=recent_reports,
    created_at=patient.created_at,
  )


@router.get("/{patient_id}/timeline", response_model=list[TimelineEventResponse])
def get_timeline(patient_id: int, db: Session = Depends(get_db)):
  patient = db.get(models.Patient, patient_id)
  if not patient:
    raise HTTPException(status_code=404, detail="Patient not found")
  events = (
    db.query(models.TimelineEvent)
    .filter(models.TimelineEvent.patient_id == patient_id)
    .order_by(models.TimelineEvent.timestamp.desc())
    .all()
  )
  return [TimelineEventResponse.model_validate(event) for event in events]
