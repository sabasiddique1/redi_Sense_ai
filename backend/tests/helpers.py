from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from backend.db import models


class FakeQuery:
  def __init__(self, items: list[Any]):
    self.items = items

  def count(self) -> int:
    return len(self.items)


class FakeSession:
  def __init__(
    self,
    *,
    patients: dict[int, models.Patient] | None = None,
    evidence_documents: list[models.EvidenceDocument] | None = None,
  ):
    self.patients = patients or {}
    self.evidence_documents = evidence_documents or []
    self.conversations: dict[int, models.CopilotConversation] = {}
    self.messages: list[models.CopilotMessage] = []
    self.reports: list[models.Report] = []
    self.triage_sessions: list[models.TriageSession] = []
    self.timeline_events: list[models.TimelineEvent] = []
    self._pending: list[Any] = []
    self._id_counter = 1

  def get(self, model: Any, object_id: int | None):
    if object_id is None:
      return None
    if model is models.Patient:
      return self.patients.get(object_id)
    if model is models.CopilotConversation:
      return self.conversations.get(object_id)
    return None

  def add(self, obj: Any) -> None:
    self._pending.append(obj)

  def flush(self) -> None:
    for obj in self._pending:
      if getattr(obj, "id", None) is None:
        obj.id = self._id_counter
        self._id_counter += 1

      if isinstance(obj, models.Report):
        if getattr(obj, "created_at", None) is None:
          obj.created_at = datetime.now(timezone.utc)
        self.reports.append(obj)
      elif isinstance(obj, models.TriageSession):
        if getattr(obj, "created_at", None) is None:
          obj.created_at = datetime.now(timezone.utc)
        self.triage_sessions.append(obj)
      elif isinstance(obj, models.TimelineEvent):
        if getattr(obj, "timestamp", None) is None:
          obj.timestamp = datetime.now(timezone.utc)
        self.timeline_events.append(obj)
      elif isinstance(obj, models.CopilotConversation):
        if getattr(obj, "created_at", None) is None:
          obj.created_at = datetime.now(timezone.utc)
        if getattr(obj, "updated_at", None) is None:
          obj.updated_at = datetime.now(timezone.utc)
        self.conversations[obj.id] = obj
      elif isinstance(obj, models.CopilotMessage):
        if getattr(obj, "created_at", None) is None:
          obj.created_at = datetime.now(timezone.utc)
        self.messages.append(obj)

    self._pending.clear()

  def refresh(self, _obj: Any) -> None:
    return None

  def commit(self) -> None:
    return None

  def query(self, model: Any) -> FakeQuery:
    if model is models.EvidenceDocument:
      return FakeQuery(self.evidence_documents)
    raise AssertionError(f"FakeSession query not implemented for {model}")
