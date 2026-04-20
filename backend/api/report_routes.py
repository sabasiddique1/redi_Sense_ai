from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.schemas import (
  ReportAnalysisRequest,
  ReportAnalysisResponse,
  ReportUploadResponse,
)
from backend.agents.report_agent import get_report_agent
from backend.services.storage_service import handle_report_upload


router = APIRouter(prefix="/api/report", tags=["report"])


@router.post("/analyze", response_model=ReportAnalysisResponse)
def analyze_report(payload: ReportAnalysisRequest, db: Session = Depends(get_db)):
  if not payload.report_text:
    raise HTTPException(status_code=400, detail="report_text is required")
  agent = get_report_agent()
  result = agent.analyze_report(db, payload.patient_id, payload.report_text)
  return ReportAnalysisResponse(**result)


@router.post("/upload", response_model=ReportUploadResponse)
async def upload_report(
  patient_id: int | None = Form(default=None),
  file: UploadFile = File(...),
  db: Session = Depends(get_db),
):
  upload = await handle_report_upload(file)
  agent = get_report_agent()
  result = agent.analyze_report(
    db,
    patient_id,
    upload.extracted_text,
    title=upload.original_filename,
    source_filename=upload.original_filename,
    mime_type=upload.mime_type,
    file_size_bytes=upload.size_bytes,
  )
  return ReportUploadResponse(
    filename=upload.original_filename,
    mime_type=upload.mime_type,
    text_preview=upload.extracted_text[:1000],
    **result,
  )
