from __future__ import annotations

import unittest

from backend.services.triage_service import (
  build_grounded_triage_assessment,
  merge_triage_with_model,
  normalize_structured_triage_input,
)


class TriageServiceTests(unittest.TestCase):
  def test_grounded_assessment_uses_duration_severity_and_vitals(self):
    result = build_grounded_triage_assessment(
      (
        "62yo M with chest tightness for 2 hours, severity 8/10, radiating to left arm, "
        "shortness of breath, sweating, and BP 90/60."
      )
    )

    self.assertEqual(result["risk_level"], "Critical")
    self.assertEqual(result["care_level"], "Emergency")
    self.assertIn("chest pain or pressure", result["summary"])
    self.assertIn("Seek emergency care now", result["recommended_action"])

  def test_structured_chronic_back_pain_without_red_flags_stays_non_urgent(self):
    structured_input = {
      "age": 27,
      "sex": "female",
      "main_symptom": "chronic back pain",
      "duration_value": 8,
      "duration_unit": "months",
      "severity": 4,
      "location": "back",
      "radiation": ["neck"],
      "associated_symptoms": [],
      "aggravating_factors": ["sitting"],
      "relieving_factors": ["movement"],
      "red_flags": [],
      "no_red_flags": True,
      "relevant_history": ["chronic_back_pain"],
      "additional_details": "Pain is centered in the neck and upper back.",
    }

    result = build_grounded_triage_assessment(
      "chronic back pain",
      structured_input=structured_input,
    )

    self.assertEqual(result["care_level"], "Self-care")
    self.assertEqual(result["risk_level"], "Low")
    self.assertEqual(result["red_flags"], [])
    self.assertNotIn("Acute coronary syndrome", result["differential"])
    self.assertNotIn("Pulmonary embolism", result["differential"])
    self.assertIn("chronic back or neck pain", result["summary"])

  def test_template_hint_text_no_longer_creates_fake_red_flags(self):
    result = build_grounded_triage_assessment(
      (
        "Main symptom: chronic back pain\n"
        "Associated symptoms: pain radiating to neck center\n"
        "What makes it worse or better: movement makes it better and sitting idle makes it worse\n"
        "Red flags (fainting, chest pain, breathing trouble, confusion, bleeding, fever): none"
      )
    )

    self.assertNotIn("Chest pain or pressure was reported", result["red_flags"])
    self.assertNotIn("Acute coronary syndrome", result["differential"])
    self.assertNotIn("Pulmonary embolism", result["differential"])

  def test_minutes_duration_and_general_respiratory_pattern_are_supported(self):
    result = build_grounded_triage_assessment(
      "sore throat and cough",
      structured_input={
        "age": 22,
        "sex": "male",
        "main_symptom": "sore throat",
        "duration_value": 45,
        "duration_unit": "minutes",
        "severity": 3,
        "location": "throat",
        "associated_symptoms": ["cough", "runny_nose"],
        "red_flags": [],
        "no_red_flags": True,
      },
    )

    self.assertEqual(result["care_level"], "Routine")
    self.assertIn("Upper respiratory infection", result["differential"])
    self.assertIn("acute symptom", " ".join(result["reasoning"]).lower())

  def test_merge_filters_cardiac_differential_for_low_risk_back_pain(self):
    normalized = normalize_structured_triage_input(
      {
        "age": 24,
        "main_symptom": "back pain",
        "duration_value": 4,
        "duration_unit": "months",
        "severity": 3,
        "location": "back",
        "red_flags": [],
        "no_red_flags": True,
        "relieving_factors": ["movement"],
      }
    )
    grounded = build_grounded_triage_assessment(
      "back pain",
      structured_input={
        "age": 24,
        "main_symptom": "back pain",
        "duration_value": 4,
        "duration_unit": "months",
        "severity": 3,
        "location": "back",
        "red_flags": [],
        "no_red_flags": True,
        "relieving_factors": ["movement"],
      },
    )

    merged = merge_triage_with_model(
      grounded,
      {
        "summary": "This sounds concerning for chest pain and possible acute coronary syndrome.",
        "differential": ["Acute coronary syndrome", "Pulmonary embolism", "Mechanical back pain"],
      },
      normalized_input=normalized,
    )

    self.assertEqual(merged["summary"], grounded["summary"])
    self.assertEqual(merged["differential"], ["Mechanical back pain"])


if __name__ == "__main__":
  unittest.main()
