from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from backend.config import get_settings
from backend.core.auth import auth_dependency
from backend.core.logging import configure_logging, get_request_id, set_request_id
from backend.db.database import SessionLocal
from backend.api import (
  copilot_routes,
  evidence_routes,
  patient_routes,
  report_routes,
  system_routes,
  triage_routes,
)


settings = get_settings()
configure_logging(settings.log_level)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name)


app.add_middleware(
  CORSMiddleware,
  allow_origins=settings.allowed_origins if settings.allowed_origins else ["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
  request_id = request.headers.get("X-Request-ID") or str(uuid4())
  set_request_id(request_id)
  request.state.request_id = request_id

  try:
    response = await call_next(request)
  except Exception:
    logger.exception("Unhandled request error method=%s path=%s", request.method, request.url.path)
    response = JSONResponse(
      status_code=500,
      content={
        "detail": "Internal server error",
        "request_id": request_id,
      },
    )
    response.headers["X-Request-ID"] = request_id
    return response

  response.headers["X-Request-ID"] = request_id
  logger.info(
    "Handled request method=%s path=%s status=%s",
    request.method,
    request.url.path,
    response.status_code,
  )
  return response


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
  logger.exception("Application exception path=%s", request.url.path)
  response = JSONResponse(
    status_code=500,
    content={
      "detail": "Internal server error",
      "request_id": get_request_id(),
    },
  )
  request_id = get_request_id()
  if request_id:
    response.headers["X-Request-ID"] = request_id
  return response


@app.get("/health")
def health():
  with SessionLocal() as db:
    db.execute(text("SELECT 1"))

  return {
    "status": "ok",
    "database": "ok",
    "auth_enabled": settings.auth_enabled,
  }


app.include_router(report_routes.router, dependencies=[Depends(auth_dependency)])
app.include_router(triage_routes.router, dependencies=[Depends(auth_dependency)])
app.include_router(copilot_routes.router, dependencies=[Depends(auth_dependency)])
app.include_router(patient_routes.router, dependencies=[Depends(auth_dependency)])
app.include_router(evidence_routes.router, dependencies=[Depends(auth_dependency)])
app.include_router(system_routes.router)


if __name__ == "__main__":
  import uvicorn

  uvicorn.run(
    "backend.main:app",
    host=settings.api_host,
    port=settings.api_port,
    reload=settings.environment == "development",
  )
