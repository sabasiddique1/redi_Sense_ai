from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.schemas import ReportAnalysisRequest, ReportAnalysisResult
from backend.agents.report_agent import get_report_agent
from backend.services.storage_service import handle_report_upload


router = APIRouter(prefix="/api/report", tags=["report"])


@router.post("/analyze", response_model=ReportAnalysisResult)
def analyze_report(payload: ReportAnalysisRequest, db: Session = Depends(get_db)):
  if not payload.report_text:
    raise HTTPException(status_code=400, detail="report_text is required")
  agent = get_report_agent()
  result = agent.analyze_report(db, payload.patient_id, payload.report_text)
  return ReportAnalysisResult(**result)


@router.post("/upload")
async def upload_report(file: UploadFile = File(...), db: Session = Depends(get_db)):
  path, text = await handle_report_upload(file)
  agent = get_report_agent()
  result = agent.analyze_report(db, None, text)
  return {
    "filename": path.name,
    "text_preview": text[:1000],
    **result,
  }

