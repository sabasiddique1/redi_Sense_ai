from fastapi import APIRouter, Depends

from backend.db.schemas import EvidenceSearchRequest, EvidenceSearchResult
from backend.agents.evidence_agent import get_evidence_agent


router = APIRouter(prefix="/api/evidence", tags=["evidence"])


@router.get("/search", response_model=EvidenceSearchResult)
def search_evidence_get(query: str):
  agent = get_evidence_agent()
  result = agent.search_evidence(query)
  return EvidenceSearchResult(**result)


@router.post("/search", response_model=EvidenceSearchResult)
def search_evidence_post(payload: EvidenceSearchRequest):
  agent = get_evidence_agent()
  result = agent.search_evidence(payload.query)
  return EvidenceSearchResult(**result)

