from __future__ import annotations

from datetime import date
import unittest

from backend.agents.triage_agent import TriageAgent
from backend.db import models

from backend.tests.helpers import FakeSession


class TriageAgentTests(unittest.TestCase):
  def test_invalid_input_does_not_create_fake_cardiac_red_flags(self):
    agent = TriageAgent()
    agent.ai = object()  # should not be called for invalid input
    db = FakeSession()

    result = agent.triage(db, None, "You are a dummy")

    self.assertTrue(result["invalid_input"])
    self.assertEqual(result["mode"], "error")
    self.assertEqual(result["red_flags"], [])
    self.assertIsNone(result["session_id"])
    self.assertEqual(db.triage_sessions, [])
    self.assertEqual(db.timeline_events, [])

  def test_structured_input_keeps_rule_based_urgency_even_if_model_escalates(self):
    class FakeAI:
      def triage(self, _payload: str):
        return {
          "risk_level": "Critical",
          "red_flags": ["Possible cardiopulmonary emergency"],
          "recommended_action": "Immediate emergency evaluation.",
          "summary": "This sounds like chest pain and syncope.",
          "differential": ["Acute coronary syndrome", "Pulmonary embolism", "Mechanical back pain"],
          "mode": "openai",
        }

    patient = models.Patient(id=1, name="Jane Doe")
    db = FakeSession(patients={1: patient})
    agent = TriageAgent()
    agent.ai = FakeAI()

    result = agent.triage(
      db,
      1,
      "chronic back pain",
      {
        "age": 27,
        "sex": "female",
        "main_symptom": "chronic back pain",
        "duration_value": 8,
        "duration_unit": "months",
        "severity": 4,
        "location": "back",
        "radiation": ["neck"],
        "aggravating_factors": ["sitting"],
        "relieving_factors": ["movement"],
        "red_flags": [],
        "no_red_flags": True,
        "relevant_history": ["chronic_back_pain"],
      },
    )

    self.assertFalse(result["invalid_input"])
    self.assertEqual(result["mode"], "real")
    self.assertEqual(result["care_level"], "Self-care")
    self.assertEqual(result["risk_level"], "Low")
    self.assertEqual(result["red_flags"], [])
    self.assertEqual(result["differential"], ["Mechanical back pain"])
    self.assertIsNotNone(result["session_id"])
    self.assertIsNotNone(result["timeline_event_id"])

  def test_linked_patient_context_is_passed_to_ai(self):
    class FakeAI:
      def __init__(self):
        self.last_input: str | None = None

      def triage(self, payload: str):
        self.last_input = payload
        return {
          "risk_level": "Low",
          "red_flags": [],
          "recommended_action": "Schedule routine outpatient review.",
          "summary": "Model summary.",
          "differential": ["Mechanical back pain"],
          "mode": "openai",
        }

    patient = models.Patient(
      id=1,
      name="Jane Doe",
      dob=date(1988, 4, 2),
      gender="Female",
      conditions=["Migraine", "Hypertension"],
      medications=["Propranolol"],
      allergies=["Penicillin"],
      history_summary="Recurrent headaches with photophobia.",
    )
    db = FakeSession(patients={1: patient})
    agent = TriageAgent()
    fake_ai = FakeAI()
    agent.ai = fake_ai

    agent.triage(
      db,
      1,
      "back pain",
      {
        "main_symptom": "back pain",
        "duration_value": 2,
        "duration_unit": "days",
        "location": "back",
        "red_flags": [],
        "no_red_flags": True,
      },
    )

    self.assertIsNotNone(fake_ai.last_input)
    last_input = fake_ai.last_input or ""
    self.assertIn("\"grounded_assessment\"", last_input)
    self.assertIn("\"patient_context\"", last_input)
    self.assertIn("Known conditions: Migraine, Hypertension", last_input)


if __name__ == "__main__":
  unittest.main()
