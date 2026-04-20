from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.schemas import EvidenceSearchRequest, EvidenceSearchResult
from backend.agents.evidence_agent import get_evidence_agent


router = APIRouter(prefix="/api/evidence", tags=["evidence"])


@router.get("/search", response_model=EvidenceSearchResult)
def search_evidence_get(
  query: str = Query(min_length=2, max_length=500),
  db: Session = Depends(get_db),
):
  agent = get_evidence_agent()
  result = agent.search_evidence(db, query)
  return EvidenceSearchResult(**result)


@router.post("/search", response_model=EvidenceSearchResult)
def search_evidence_post(payload: EvidenceSearchRequest, db: Session = Depends(get_db)):
  agent = get_evidence_agent()
  result = agent.search_evidence(db, payload.query)
  return EvidenceSearchResult(**result)
