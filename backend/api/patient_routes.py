from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db import models
from backend.db.schemas import Patient, TimelineEvent


router = APIRouter(prefix="/api/patient", tags=["patient"])


@router.get("/{patient_id}", response_model=Patient)
def get_patient(patient_id: int, db: Session = Depends(get_db)):
  patient = db.get(models.Patient, patient_id)
  if not patient:
    raise HTTPException(status_code=404, detail="Patient not found")
  return patient


@router.get("/{patient_id}/timeline", response_model=list[TimelineEvent])
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
  return events

