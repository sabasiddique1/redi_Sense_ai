from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.sql import operators

from backend.db import models


class FakeQuery:
  """Minimal in-memory stand-in for ``Session.query``.

  Supports the subset used by services under test: ``count``, ``all``,
  ``first``, ``limit``, ``order_by`` on a single column (asc/desc), and
  ``filter`` with simple ``column <op> literal`` comparisons.
  """

  def __init__(self, items: list[Any]):
    self.items = list(items)

  def count(self) -> int:
    return len(self.items)

  def all(self) -> list[Any]:
    return list(self.items)

  def first(self) -> Any | None:
    return self.items[0] if self.items else None

  def limit(self, n: int) -> "FakeQuery":
    return FakeQuery(self.items[:n])

  def filter(self, *criteria: Any) -> "FakeQuery":
    items = self.items
    for criterion in criteria:
      key = criterion.left.key
      op = criterion.operator
      value = criterion.right.value
      items = [obj for obj in items if _compare(getattr(obj, key), op, value)]
    return FakeQuery(items)

  def order_by(self, *clauses: Any) -> "FakeQuery":
    items = self.items
    for clause in reversed(clauses):
      element = getattr(clause, "element", clause)
      key = element.key
      descending = getattr(clause, "modifier", None) is operators.desc_op
      items = sorted(
        items,
        key=lambda obj: _sort_key(getattr(obj, key)),
        reverse=descending,
      )
    return FakeQuery(items)


def _sort_key(value: Any) -> Any:
  if isinstance(value, datetime) and value.tzinfo is None:
    return value.replace(tzinfo=timezone.utc)
  return value


def _compare(left: Any, op: Any, right: Any) -> bool:
  if left is None:
    return False
  return bool(op(_sort_key(left), _sort_key(right)))


class FakeSession:
  def __init__(
    self,
    *,
    patients: dict[int, models.Patient] | None = None,
    evidence_documents: list[models.EvidenceDocument] | None = None,
    evidence_chunks: list[models.EvidenceChunk] | None = None,
    reports: list[models.Report] | None = None,
    triage_sessions: list[models.TriageSession] | None = None,
    timeline_events: list[models.TimelineEvent] | None = None,
  ):
    self.patients = patients or {}
    self.evidence_documents = evidence_documents or []
    self.evidence_chunks = evidence_chunks or []
    self.conversations: dict[int, models.CopilotConversation] = {}
    self.messages: list[models.CopilotMessage] = []
    self.reports: list[models.Report] = list(reports or [])
    self.triage_sessions: list[models.TriageSession] = list(triage_sessions or [])
    self.timeline_events: list[models.TimelineEvent] = list(timeline_events or [])
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

  def close(self) -> None:
    return None

  def query(self, model: Any) -> FakeQuery:
    tables = {
      models.Patient: list(self.patients.values()),
      models.Report: self.reports,
      models.TriageSession: self.triage_sessions,
      models.TimelineEvent: self.timeline_events,
      models.EvidenceDocument: self.evidence_documents,
      models.EvidenceChunk: self.evidence_chunks,
    }
    if model in tables:
      return FakeQuery(tables[model])
    raise AssertionError(f"FakeSession query not implemented for {model}")
