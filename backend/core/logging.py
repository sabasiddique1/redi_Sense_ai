from __future__ import annotations

import logging
from contextvars import ContextVar


_request_id: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIdFilter(logging.Filter):
  def filter(self, record: logging.LogRecord) -> bool:
    record.request_id = _request_id.get("-")
    return True


def set_request_id(request_id: str) -> None:
  _request_id.set(request_id)


def get_request_id() -> str:
  return _request_id.get("-")


def configure_logging(level: str = "INFO") -> None:
  if getattr(configure_logging, "_configured", False):
    return

  handler = logging.StreamHandler()
  handler.addFilter(RequestIdFilter())
  handler.setFormatter(
    logging.Formatter(
      "%(asctime)s level=%(levelname)s logger=%(name)s request_id=%(request_id)s %(message)s"
    )
  )

  root = logging.getLogger()
  root.handlers.clear()
  root.addHandler(handler)
  root.setLevel(level.upper())

  configure_logging._configured = True
