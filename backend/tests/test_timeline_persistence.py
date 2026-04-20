from __future__ import annotations

import unittest

from backend.agents.report_agent import ReportAgent
from backend.agents.triage_agent import TriageAgent
from backend.db import models

from backend.tests.helpers import FakeSession


class TimelinePersistenceTests(unittest.TestCase):
  def test_report_upload_creates_timeline_event(self):
    class FakeAI:
      def analyze_report(self, _text: str):
        return {
          "classification": "Chest CT",
          "key_findings": ["Pulmonary nodule noted"],
          "summary": "Pulmonary nodule requires follow-up.",
          "structured_data": {"recommendation": "Repeat CT in 3 months"},
          "mode": "extraction_only",
          "fallback_reason": "openai_timeout",
        }

    patient = models.Patient(id=1, name="Jane Doe")
    db = FakeSession(patients={1: patient})
    agent = ReportAgent()
    agent.ai = FakeAI()

    result = agent.analyze_report(db, 1, "Pulmonary nodule follow-up report")

    self.assertEqual(result["mode"], "fallback")
    self.assertEqual(result["ai_mode"], "extraction_only")
    self.assertEqual(result["fallback_reason"], "openai_timeout")
    self.assertIsNotNone(result["timeline_event_id"])
    self.assertEqual(len(db.timeline_events), 1)
    self.assertEqual(db.timeline_events[0].patient_id, 1)

  def test_triage_creates_timeline_event_for_valid_input(self):
    class FakeAI:
      def triage(self, _symptoms: str):
        return {
          "risk_level": "Critical",
          "red_flags": ["Chest pain or pressure was reported"],
          "recommended_action": "Immediate emergency evaluation is recommended.",
          "summary": "Cardiopulmonary red flags are present.",
          "differential": ["Acute coronary syndrome"],
          "mode": "openai",
          "fallback_reason": None,
        }

    patient = models.Patient(id=1, name="Jane Doe")
    db = FakeSession(patients={1: patient})
    agent = TriageAgent()
    agent.ai = FakeAI()

    result = agent.triage(db, 1, "Chest pain radiating to the left arm with sweating for 1 hour")

    self.assertEqual(result["mode"], "real")
    self.assertIsNotNone(result["timeline_event_id"])
    self.assertEqual(len(db.timeline_events), 1)
    self.assertEqual(db.timeline_events[0].patient_id, 1)


if __name__ == "__main__":
  unittest.main()
