from __future__ import annotations

from datetime import datetime, timezone
import unittest

from backend.agents.copilot_agent import CopilotAgent
from backend.db import models
from backend.services.vector_service import EvidenceSearchOutcome

from backend.tests.helpers import FakeSession


class CopilotAgentTests(unittest.TestCase):
  def test_copilot_fallback_uses_patient_context(self):
    now = datetime.now(timezone.utc)
    patient = models.Patient(
      id=1,
      name="Jane Doe",
      mrn="MRN-001",
      history_summary="Pulmonary nodule surveillance.",
      conditions=["Pulmonary nodule"],
      medications=["Atorvastatin 20mg nightly"],
      alerts=[{"label": "Follow-up needed", "detail": "Nodule surveillance due"}],
      tasks=[{"label": "Repeat chest CT", "status": "Pending"}],
      created_at=now,
    )
    report = models.Report(
      id=10,
      patient_id=1,
      classification="Chest CT",
      summary="Right upper lobe nodule increased in size.",
      key_findings=["Right upper lobe nodule increased from 8mm to 12mm"],
      structured_data={"recommendation": "Repeat CT in 3 months"},
      created_at=now,
      report_text="",
    )
    triage = models.TriageSession(
      id=11,
      patient_id=1,
      symptoms="Shortness of breath on exertion",
      risk_level="High",
      red_flags=["Shortness of breath was reported"],
      recommended_action="Urgent same-day in-person clinical evaluation is recommended.",
      summary="Shortness of breath requires urgent evaluation.",
      differential=["Pulmonary embolism"],
      created_at=now,
    )
    event = models.TimelineEvent(
      id=12,
      patient_id=1,
      event_type="report_uploaded",
      title="Chest CT analyzed",
      summary="Nodule follow-up updated",
      timestamp=now,
    )

    class FakeAI:
      def chat(self, _message: str, context: str | None = None, *, evidence_items=None):
        self.context = context
        self.evidence_items = evidence_items
        return {
          "reply": "generic fallback",
          "citation_ids": [],
          "insufficient_evidence": True,
          "mode": "heuristic",
          "fallback_reason": "provider_unavailable",
        }

    class FakeVector:
      def search(self, _db, _query: str, top_k=4, dedupe_by_document=False):
        return EvidenceSearchOutcome(
          results=[
            {
              "id": "chunk-1",
              "document_id": 1,
              "title": "Pulmonary Nodule Follow-up Primer",
              "text": "Enlarging nodules above 8 mm often prompt PET CT and thoracic consultation.",
              "source": "ReportIQ curated local dataset",
              "url": "https://example.local/evidence/pulmonary-nodule-follow-up",
              "section": "Pulmonary nodules",
              "page": None,
              "score": 0.91,
            }
          ],
          mode="real",
          ai_mode="openai",
          latency_ms=24,
          normalized_query="pulmonary nodule surveillance",
          trace={"normalized_query": "pulmonary nodule surveillance"},
        )

    db = FakeSession()
    agent = CopilotAgent()
    agent.ai = FakeAI()
    agent.vector = FakeVector()
    agent._collect_patient_context = lambda _db, _patient_id: {
      "patient": patient,
      "alerts": patient.alerts,
      "tasks": patient.tasks,
      "recent_reports": [report],
      "recent_triages": [triage],
      "recent_events": [event],
    }

    result = agent.chat(
      db,
      message="Summarize the current patient context and top risks.",
      patient_id=1,
    )

    self.assertEqual(result["mode"], "fallback")
    self.assertEqual(result["fallback_reason"], "provider_unavailable")
    self.assertTrue(result["context_used"])
    self.assertIn("Current patient context for Jane Doe", result["reply"])
    self.assertIn("Recent report findings:", result["reply"])
    self.assertIn("Recent triage history:", result["reply"])
    self.assertIn("Top active concerns:", result["reply"])
    self.assertTrue(result["citations"])
    self.assertEqual(result["citations"][0]["title"], "Pulmonary Nodule Follow-up Primer")

  def test_copilot_success_maps_only_retrieved_citations(self):
    patient = models.Patient(
      id=1,
      name="Jane Doe",
      mrn="MRN-001",
      history_summary="Pulmonary nodule surveillance.",
      conditions=["Pulmonary nodule"],
      created_at=datetime.now(timezone.utc),
    )

    class FakeAI:
      def chat(self, _message: str, context: str | None = None, *, evidence_items=None):
        self.context = context
        self.evidence_items = evidence_items
        return {
          "reply": "The retrieved evidence supports follow-up imaging and thoracic consultation.",
          "citation_ids": ["E1", "E9"],
          "insufficient_evidence": False,
          "mode": "openai",
          "fallback_reason": None,
        }

    class FakeVector:
      def search(self, _db, _query: str, top_k=4, dedupe_by_document=False):
        return EvidenceSearchOutcome(
          results=[
            {
              "id": "chunk-1",
              "document_id": 1,
              "title": "Pulmonary Nodule Follow-up Primer",
              "text": "Suspicious nodules above 8 mm often warrant PET CT and thoracic consultation.",
              "source": "ReportIQ curated local dataset",
              "url": "https://example.local/evidence/pulmonary-nodule-follow-up",
              "section": "Pulmonary nodules",
              "page": None,
              "score": 0.96,
            }
          ],
          mode="real",
          ai_mode="openai",
          latency_ms=18,
          normalized_query="pulmonary nodule question",
          trace={"normalized_query": "pulmonary nodule question"},
        )

    db = FakeSession()
    agent = CopilotAgent()
    agent.ai = FakeAI()
    agent.vector = FakeVector()
    agent._collect_patient_context = lambda _db, _patient_id: {
      "patient": patient,
      "alerts": [],
      "tasks": [],
      "recent_reports": [],
      "recent_triages": [],
      "recent_events": [],
    }

    result = agent.chat(
      db,
      message="What follow-up is usually recommended for this pulmonary nodule?",
      patient_id=1,
    )

    self.assertEqual(result["mode"], "real")
    self.assertEqual(result["ai_mode"], "openai")
    self.assertEqual(len(result["citations"]), 1)
    self.assertEqual(result["citations"][0]["citation_id"], "E1")
    self.assertEqual(result["citations"][0]["chunk_id"], "chunk-1")
    self.assertFalse(result["insufficient_evidence"])
    self.assertIn("prompt_version", result["rag_trace"])


if __name__ == "__main__":
  unittest.main()
