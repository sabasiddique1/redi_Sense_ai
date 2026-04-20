from __future__ import annotations

import unittest
from unittest.mock import patch

from backend.services.openai_service import (
  StructuredChatError,
  generate_report_analysis,
)


class ReportAnalysisServiceTests(unittest.TestCase):
  def test_report_fallback_is_extraction_only_and_source_grounded(self):
    report_text = (
      "CT CHEST WITH CONTRAST\n\n"
      "Findings: Right upper lobe pulmonary nodule now measures 12 mm, previously 8 mm. "
      "Subtle spiculation is present.\n\n"
      "Impression: Interval enlargement of the right upper lobe pulmonary nodule with suspicious morphology. "
      "Recommend PET-CT and thoracic surgery consultation."
    )

    with patch(
      "backend.services.openai_service._run_structured_chat",
      side_effect=StructuredChatError(
        feature="report_analysis",
        fallback_reason="json_parse_failed",
        error_type="JSONDecodeError",
      ),
    ):
      result = generate_report_analysis(report_text)

    self.assertEqual(result["mode"], "extraction_only")
    self.assertEqual(result["fallback_reason"], "json_parse_failed")
    self.assertIn("AI interpretation unavailable", result["plain_language_summary"])
    self.assertTrue(result["extracted_findings"])
    self.assertIn("PET-CT", " ".join(result["follow_up_recommendations"]))
    self.assertNotIn("this means cancer", result["plain_language_summary"].lower())


if __name__ == "__main__":
  unittest.main()
