from __future__ import annotations

from functools import lru_cache
import logging

from sqlalchemy.orm import Session

from backend.db import models
from backend.services.vector_service import get_vector_service


logger = logging.getLogger(__name__)


class EvidenceAgent:
  def __init__(self):
    self.vector = get_vector_service()

  def search_evidence(self, db: Session, query: str) -> dict[str, object]:
    cleaned_query = query.strip()
    if not cleaned_query:
      return {
        "query": cleaned_query,
        "sources": [],
        "mode": "error",
        "ai_mode": None,
        "fallback_reason": None,
        "latency_ms": 0,
        "error_message": "Enter a clinical topic or symptom phrase to search the evidence index.",
        "trace": None,
      }

    document_count = db.query(models.EvidenceDocument).count()
    if document_count == 0:
      logger.warning("Evidence search unavailable query=%s reason=no_indexed_documents", cleaned_query)
      return {
        "query": cleaned_query,
        "sources": [],
        "mode": "error",
        "ai_mode": None,
        "fallback_reason": "vector_index_missing",
        "latency_ms": 0,
        "error_message": "Evidence index is unavailable. Run the evidence ingestion script and try again.",
        "trace": None,
      }

    search_outcome = self.vector.search(db, cleaned_query, top_k=5)
    sources: list[dict[str, object]] = []
    for result in search_outcome.results:
      sources.append(
        {
          "id": result["id"],
          "title": result["title"],
          "snippet": result["text"][:400],
          "source": result.get("source"),
          "url": result.get("url"),
          "section": result.get("section"),
          "page": result.get("page"),
          "score": result.get("score", 0.0),
        }
      )
    logger.info(
      (
        "Evidence search completed query=%s normalized_query=%s result_count=%s "
        "mode=%s ai_mode=%s fallback_reason=%s latency_ms=%s"
      ),
      cleaned_query,
      search_outcome.normalized_query,
      len(sources),
      search_outcome.mode,
      search_outcome.ai_mode,
      search_outcome.fallback_reason,
      search_outcome.latency_ms,
    )
    return {
      "query": cleaned_query,
      "sources": sources,
      "mode": search_outcome.mode,
      "ai_mode": search_outcome.ai_mode,
      "fallback_reason": search_outcome.fallback_reason,
      "latency_ms": search_outcome.latency_ms,
      "error_message": search_outcome.error_message,
      "trace": search_outcome.trace,
    }


@lru_cache(maxsize=1)
def get_evidence_agent() -> EvidenceAgent:
  return EvidenceAgent()
