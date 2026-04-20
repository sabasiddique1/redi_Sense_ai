from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from backend.db import models


logger = logging.getLogger(__name__)


def create_timeline_event(
  db: Session,
  *,
  patient_id: int | None,
  event_type: str,
  title: str,
  summary: str,
  metadata: dict[str, Any] | None = None,
) -> models.TimelineEvent | None:
  if patient_id is None:
    logger.warning(
      "Skipping timeline event creation event_type=%s reason=no_patient_id",
      event_type,
    )
    return None

  event = models.TimelineEvent(
    patient_id=patient_id,
    event_type=event_type,
    title=title,
    summary=summary,
    event_metadata=metadata or {},
  )
  db.add(event)
  db.flush()
  logger.info(
    "Timeline event created patient_id=%s event_id=%s event_type=%s",
    patient_id,
    event.id,
    event_type,
  )
  return event
