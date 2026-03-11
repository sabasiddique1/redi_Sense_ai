from typing import List, Dict, Any, Optional

import numpy as np
from openai import OpenAI

from backend.config import get_settings

settings = get_settings()


class VectorService:
  """
  Abstraction over vector search.

  For now this uses in-memory storage with OpenAI embeddings.
  It is structured so it can be replaced with Pinecone or pgvector.
  """

  def __init__(self):
    self._client = OpenAI(api_key=settings.openai_api_key)
    self._dim = 1536
    self._items: list[tuple[str, str, np.ndarray]] = []

  def _embed(self, text: str) -> np.ndarray:
    resp = self._client.embeddings.create(
      model="text-embedding-3-small",
      input=text,
    )
    return np.array(resp.data[0].embedding, dtype="float32")

  def add_document(self, doc_id: str, text: str):
    vec = self._embed(text)
    self._items.append((doc_id, text, vec))

  def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    if not self._items:
      return []
    q = self._embed(query)
    scores: list[tuple[float, str, str]] = []
    for doc_id, text, vec in self._items:
      sim = float(np.dot(q, vec) / (np.linalg.norm(q) * np.linalg.norm(vec)))
      scores.append((sim, doc_id, text))
    scores.sort(reverse=True, key=lambda t: t[0])
    results: List[Dict[str, Any]] = []
    for score, doc_id, text in scores[:top_k]:
      results.append(
        {
          "id": doc_id,
          "score": score,
          "text": text,
        }
      )
    return results


_vector_service: Optional[VectorService] = None


def get_vector_service() -> VectorService:
  global _vector_service
  if _vector_service is None:
    _vector_service = VectorService()
  return _vector_service

