from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.schemas import TriageAnalyzeRequest, TriageAnalyzeResponse
from backend.agents.triage_agent import get_triage_agent


router = APIRouter(prefix="/api/triage", tags=["triage"])


@router.post("/analyze", response_model=TriageAnalyzeResponse)
def analyze_triage(payload: TriageAnalyzeRequest, db: Session = Depends(get_db)):
  if payload.structured_input is None and not payload.symptoms:
    raise HTTPException(status_code=400, detail="symptoms are required")
  agent = get_triage_agent()
  result = agent.triage(
    db,
    payload.patient_id,
    payload.symptoms,
    payload.structured_input.model_dump() if payload.structured_input else None,
  )
  return TriageAnalyzeResponse(**result)
