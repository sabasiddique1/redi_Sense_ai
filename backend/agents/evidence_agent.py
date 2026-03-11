from typing import Dict, Any

from backend.services.vector_service import get_vector_service


class EvidenceAgent:
  def __init__(self):
    self.vector = get_vector_service()

  def search_evidence(self, query: str) -> Dict[str, Any]:
    results = self.vector.search(query, top_k=5)
    sources = []
    for r in results:
      sources.append(
        {
          "id": r["id"],
          "title": r["id"],
          "snippet": r["text"][:400],
          "url": None,
        }
      )
    return {"sources": sources}


def get_evidence_agent() -> EvidenceAgent:
  return EvidenceAgent()

