from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from backend.db import models
from backend.db.database import get_db
from backend.main import app
from backend.services.dashboard_service import build_dashboard_summary
from backend.tests.helpers import FakeSession


def _seeded_session(now: datetime) -> FakeSession:
  patient = models.Patient(
    id=1,
    name="Lien Nguyen",
    mrn="184920",
    alerts=[{"id": "a1", "label": "Nodule surveillance", "detail": "Follow-up overdue."}],
  )
  other = models.Patient(id=2, name="Samir Ali", mrn=None, alerts=[])
  reports = [
    models.Report(
      id=10,
      patient_id=1,
      title="CT chest w/ contrast",
      summary="Interval enlargement of a nodule.",
      structured_data={"safety_flags": ["suspicious_language_present"]},
      created_at=now - timedelta(hours=1),
    ),
    models.Report(
      id=11,
      patient_id=2,
      title=None,
      classification="MRI brain",
      summary="Acute ischemia suspected.",
      structured_data={"safety_flags": ["immediate_escalation_recommended"]},
      created_at=now - timedelta(days=2),
    ),
    models.Report(
      id=12,
      patient_id=None,
      title="Ultrasound",
      summary=None,
      structured_data={},
      created_at=now - timedelta(days=3),
    ),
  ]
  triage = [
    models.TriageSession(
      id=20,
      patient_id=2,
      symptoms="Chest pain",
      risk_level="Critical",
      recommended_action="Emergency evaluation now.",
      summary="Cardiac red flags.",
      created_at=now - timedelta(hours=3),
    ),
    models.TriageSession(
      id=21,
      patient_id=1,
      symptoms="Cough",
      risk_level="low",
      recommended_action="Routine review.",
      summary="Mild symptoms.",
      created_at=now - timedelta(days=1),
    ),
    models.TriageSession(
      id=22,
      patient_id=1,
      symptoms="Old session",
      risk_level="High",
      recommended_action="Should be outside the 7-day window.",
      summary="Stale.",
      created_at=now - timedelta(days=30),
    ),
  ]
  events = [
    models.TimelineEvent(
      id=30 + index,
      patient_id=1,
      event_type="report_uploaded",
      title=f"Event {index}",
      summary="Summary",
      timestamp=now - timedelta(minutes=index),
    )
    for index in range(8)
  ]
  session = FakeSession(
    patients={1: patient, 2: other},
    reports=reports,
    triage_sessions=triage,
    timeline_events=events,
    evidence_documents=[models.EvidenceDocument(id=1, source_key="doc", title="Doc")],
    evidence_chunks=[models.EvidenceChunk(id=1, document_id=1, chunk_index=0, content="x")],
  )
  session.messages.extend(
    [
      models.CopilotMessage(id=40, conversation_id=1, role="assistant", content="a", citations=[{"title": "x"}], created_at=now - timedelta(hours=2)),
      models.CopilotMessage(id=41, conversation_id=1, role="assistant", content="b", citations=[], created_at=now - timedelta(days=2)),
      models.CopilotMessage(id=42, conversation_id=1, role="user", content="q", citations=[], created_at=now - timedelta(hours=2)),
    ]
  )
  return session


class DashboardSummaryServiceTests(unittest.TestCase):
  def test_summary_aggregates_existing_tables(self):
    now = datetime.now(timezone.utc)
    summary = build_dashboard_summary(_seeded_session(now))

    metrics = {metric["id"]: metric for metric in summary["metrics"]}
    self.assertEqual(metrics["reports-today"]["value"], "1")
    self.assertEqual(metrics["reports-today"]["footnote"], "3 on record")
    self.assertEqual(len(metrics["reports-today"]["series"]), 7)
    self.assertEqual(sum(metrics["reports-today"]["series"]), 3)
    self.assertEqual(metrics["high-risk"]["value"], "1")  # stale High session excluded
    self.assertEqual(metrics["high-risk"]["secondary"], {"value": "1", "label": "critical", "tone": "Critical"})
    self.assertIsNone(metrics["triage-time"]["value"])  # honest: no duration data
    self.assertIn("Not available", metrics["triage-time"]["footnote"])
    self.assertEqual(metrics["evidence-linked"]["value"], "50")  # 1 of 2 assistant answers cited
    self.assertEqual(metrics["evidence-linked"]["unit"], "%")

    self.assertEqual([b["value"] for b in summary["reports_by_risk"]], [0, 0, 1, 0])
    self.assertIn("100% of today's reports", summary["reports_by_risk_caption"])
    self.assertEqual(sorted(m["label"] for m in summary["modality_mix"]), ["CT", "MRI", "US"])
    self.assertEqual(sum(m["value"] for m in summary["modality_mix"]), 3)
    self.assertGreaterEqual(len(summary["hourly"]), 1)
    self.assertEqual(sum(h["value"] for h in summary["hourly"]), 1)
    self.assertEqual(summary["hourly_target"], 14)

    self.assertEqual(
      [bucket["value"] for bucket in summary["risk_distribution"]],
      [1, 0, 0, 1],
    )

    queue = summary["reports_queue"]
    self.assertEqual([row["id"] for row in queue], ["10", "11", "12"])
    self.assertEqual(queue[0]["patient_id"], "MRN 184920")
    self.assertEqual(queue[0]["mrn"], "184920")
    self.assertIsNone(queue[0]["confidence"])
    self.assertGreaterEqual(queue[0]["minutes_in_queue"], 59)
    self.assertEqual(queue[0]["risk"], "High")
    self.assertEqual(queue[1]["modality"], "MRI brain")
    self.assertEqual(queue[1]["risk"], "Critical")
    self.assertEqual(queue[2]["patient_name"], "Unassigned")
    self.assertEqual(queue[2]["risk"], "Low")

    alerts = summary["urgent_alerts"]
    self.assertEqual(alerts[0]["severity"], "Critical")
    self.assertEqual(alerts[0]["patient_name"], "Samir Ali")
    self.assertGreaterEqual(alerts[0]["elapsed_minutes"], 179)
    self.assertEqual(alerts[0]["sla_minutes"], 30)
    self.assertEqual(alerts[1]["label"], "Nodule surveillance")
    self.assertIsNone(alerts[1]["elapsed_minutes"])

    self.assertEqual(len(summary["recent_activity"]), 8)
    self.assertEqual(summary["recent_activity"][0]["patient_name"], "Lien Nguyen")
    self.assertEqual(summary["recent_activity"][0]["label"], "Event 0")
    self.assertEqual(summary["ai_insight"]["confidence"], 100)
    self.assertEqual(summary["ai_insight"]["record_count"], 6)  # 3 reports + 3 triage sessions
    self.assertIn("50%", summary["ai_insight"]["title"])

  def test_summary_handles_empty_database(self):
    summary = build_dashboard_summary(FakeSession())

    self.assertEqual(summary["reports_queue"], [])
    self.assertEqual(summary["urgent_alerts"], [])
    self.assertEqual(sum(b["value"] for b in summary["risk_distribution"]), 0)
    self.assertEqual(summary["ai_insight"]["id"], "insight-empty")
    self.assertEqual(summary["ai_insight"]["confidence"], 0)
    self.assertEqual(summary["ai_insight"]["record_count"], 0)


class DashboardSummaryRouteTests(unittest.TestCase):
  def setUp(self):
    self.now = datetime.now(timezone.utc)
    self.session = _seeded_session(self.now)
    app.dependency_overrides[get_db] = lambda: self.session
    self.client = TestClient(app)

  def tearDown(self):
    app.dependency_overrides.pop(get_db, None)

  def test_get_dashboard_summary_returns_validated_payload(self):
    response = self.client.get("/api/dashboard/summary")

    self.assertEqual(response.status_code, 200, response.text)
    payload = response.json()
    self.assertEqual(payload["mode"], "real")
    self.assertEqual(payload["risk_window_days"], 7)
    self.assertEqual(len(payload["metrics"]), 4)
    self.assertEqual(
      [bucket["label"] for bucket in payload["risk_distribution"]],
      ["Low", "Moderate", "High", "Critical"],
    )
    self.assertEqual(payload["reports_queue"][0]["risk"], "High")
    self.assertTrue(payload["reports_queue"][0]["received_at"])
    self.assertEqual(payload["trend_days"], 7)
    self.assertEqual(len(payload["metrics"][0]["series"]), 7)
    self.assertEqual(payload["metrics"][2]["value"], None)
    self.assertIn("hourly", payload)
    self.assertIn("modality_mix", payload)
    self.assertEqual(payload["urgent_alerts"][0]["severity"], "Critical")
    self.assertIn("disclaimer", payload)


if __name__ == "__main__":
  unittest.main()
