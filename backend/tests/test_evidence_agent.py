from __future__ import annotations

import unittest

from backend.agents.evidence_agent import EvidenceAgent
from backend.db import models
from backend.services.vector_service import EvidenceSearchOutcome

from backend.tests.helpers import FakeSession


class EvidenceAgentTests(unittest.TestCase):
  def test_evidence_search_returns_mode_fields(self):
    db = FakeSession(
      evidence_documents=[
        models.EvidenceDocument(id=1, source_key="doc-1", title="Pulmonary Nodule")
      ]
    )
    agent = EvidenceAgent()
    agent.vector = type(
      "FakeVector",
      (),
      {
        "search": staticmethod(
          lambda _db, _query, top_k=5: EvidenceSearchOutcome(
            results=[
              {
                "id": "1",
                "title": "Pulmonary Nodule",
                "text": "Repeat CT imaging was recommended.",
                "source": "Guideline",
                "url": None,
                "section": "Follow-up",
                "page": None,
                "score": 0.91,
              }
            ],
            mode="fallback",
            ai_mode="search_fallback",
            latency_ms=42,
            fallback_reason="lexical_search_fallback",
          )
        )
      },
    )()

    result = agent.search_evidence(db, "pulmonary nodule")

    self.assertEqual(result["mode"], "fallback")
    self.assertEqual(result["ai_mode"], "search_fallback")
    self.assertEqual(result["fallback_reason"], "lexical_search_fallback")
    self.assertEqual(result["latency_ms"], 42)
    self.assertEqual(len(result["sources"]), 1)

  def test_evidence_search_returns_structured_error_when_index_is_unavailable(self):
    agent = EvidenceAgent()
    db = FakeSession(evidence_documents=[])

    result = agent.search_evidence(db, "pulmonary nodule")

    self.assertEqual(result["mode"], "error")
    self.assertEqual(result["sources"], [])
    self.assertIn("Evidence index is unavailable", str(result["error_message"]))
    self.assertEqual(result["fallback_reason"], "vector_index_missing")


if __name__ == "__main__":
  unittest.main()
