from __future__ import annotations

import unittest

from backend.services.vector_service import VectorService


class _FakeEmbeddingItem:
  def __init__(self, *, success: bool, embedding: list[float] | None = None, error: str | None = None):
    self.success = success
    self.embedding = embedding
    self.error = error


class _FakeEmbeddingBatch:
  def __init__(self, item: _FakeEmbeddingItem):
    self.items = [item]


class _FailingAI:
  def __init__(self, error: str = "Embedding request failed"):
    self.error = error

  def embed_detailed(self, *_args, **_kwargs):
    return _FakeEmbeddingBatch(_FakeEmbeddingItem(success=False, error=self.error))


class _SuccessfulAI:
  def embed_detailed(self, *_args, **_kwargs):
    return _FakeEmbeddingBatch(_FakeEmbeddingItem(success=True, embedding=[0.1, 0.2, 0.3]))


class _StubVectorService(VectorService):
  def __init__(self, rows: list[dict[str, object]]):
    super().__init__()
    self._rows = rows
    self.ai = _FailingAI()
    self.vector_rows: list[dict[str, object]] = []

  def _load_search_rows(self, _db):
    return list(self._rows)

  def _run_vector_query(self, _db, *, embedding, started_at, filters):
    return list(self.vector_rows)


def _sample_rows() -> list[dict[str, object]]:
  return [
    {
      "id": "1",
      "document_id": 1,
      "title": "Pulmonary Nodule Follow-up Primer",
      "text": (
        "Solid pulmonary nodules that increase in size over serial imaging should be "
        "treated as higher-risk findings than stable nodules. PET CT is commonly used."
      ),
      "source": "ReportIQ curated local dataset",
      "url": "https://example.local/evidence/pulmonary-nodule-follow-up",
      "section": "Pulmonary nodules",
      "page": None,
    },
    {
      "id": "2",
      "document_id": 2,
      "title": "Chest Pain Escalation Checklist",
      "text": (
        "Chest pain with arm radiation, diaphoresis, dyspnea, or hemodynamic instability "
        "should trigger immediate escalation and ECG review."
      ),
      "source": "ReportIQ curated local dataset",
      "url": "https://example.local/evidence/chest-pain-escalation",
      "section": "Acute chest pain",
      "page": None,
    },
    {
      "id": "3",
      "document_id": 3,
      "title": "Pneumonia Initial Evaluation Notes",
      "text": (
        "Clinical concern for pneumonia is stronger when cough, fever, dyspnea, or "
        "consolidation occur together."
      ),
      "source": "ReportIQ curated local dataset",
      "url": "https://example.local/evidence/pneumonia-initial-evaluation",
      "section": "Community-acquired pneumonia",
      "page": None,
    },
  ]


class VectorServiceSearchTests(unittest.TestCase):
  def test_chunking_preserves_sections_and_token_budgets(self):
    service = VectorService()
    chunks = service._chunk_text(
      "# Section One\n\n"
      "Sentence one about pulmonary nodules. Sentence two adds more detail.\n\n"
      "# Section Two\n\n"
      "Chest pain guidance with ECG escalation and emergency review.",
      default_section="General",
    )

    self.assertTrue(chunks)
    self.assertEqual(chunks[0][0], "Section One")
    self.assertLessEqual(chunks[0][2], 260)
    self.assertEqual(chunks[-1][0], "Section Two")

  def test_fallback_ranking_matches_seeded_topics(self):
    service = _StubVectorService(_sample_rows())

    pulmonary = service.search(None, "pulmonary nodule", top_k=2)
    chest_pain = service.search(None, "chest pain", top_k=2)
    pneumonia = service.search(None, "pneumonia", top_k=2)

    self.assertEqual(pulmonary.mode, "fallback")
    self.assertEqual(pulmonary.results[0]["title"], "Pulmonary Nodule Follow-up Primer")
    self.assertEqual(chest_pain.results[0]["title"], "Chest Pain Escalation Checklist")
    self.assertEqual(pneumonia.results[0]["title"], "Pneumonia Initial Evaluation Notes")

  def test_timeout_or_embedding_failure_uses_structured_fallback(self):
    service = _StubVectorService(_sample_rows())
    service.ai = _FailingAI("RateLimitError")

    result = service.search(None, "chest pain", top_k=2)

    self.assertEqual(result.mode, "fallback")
    self.assertEqual(result.ai_mode, "search_fallback")
    self.assertEqual(result.fallback_reason, "lexical_search_fallback")
    self.assertGreaterEqual(result.latency_ms, 0)
    self.assertIn("lexical evidence matches", str(result.error_message).lower())

  def test_real_mode_is_returned_when_vector_ranking_succeeds(self):
    service = _StubVectorService(_sample_rows())
    service.ai = _SuccessfulAI()
    service.vector_rows = [
      {
        "id": "2",
        "document_id": 2,
        "title": "Chest Pain Escalation Checklist",
        "content": "Chest pain with arm radiation and diaphoresis requires escalation.",
        "source": "ReportIQ curated local dataset",
        "url": "https://example.local/evidence/chest-pain-escalation",
        "section": "Acute chest pain",
        "page": None,
        "score": 0.94,
      }
    ]

    result = service.search(None, "chest pain", top_k=2)

    self.assertEqual(result.mode, "real")
    self.assertEqual(result.ai_mode, "openai")
    self.assertEqual(result.results[0]["title"], "Chest Pain Escalation Checklist")


if __name__ == "__main__":
  unittest.main()
