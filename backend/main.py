from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import jwt
from jose.exceptions import JWTError

from backend.config import get_settings
from backend.db.database import Base, engine
from backend.api import report_routes, triage_routes, copilot_routes, patient_routes, evidence_routes


settings = get_settings()

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name)


app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],  # tighten in production
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)


def get_auth0_public_config():
  if not settings.auth0_domain or not settings.auth0_audience:
    return None
  issuer = settings.auth0_issuer or f"https://{settings.auth0_domain}/"
  return {"audience": settings.auth0_audience, "issuer": issuer}


async def auth_dependency(request: Request):
  """
  Lightweight JWT check. In development, if Auth0 is not configured,
  this becomes a no-op.
  """
  cfg = get_auth0_public_config()
  if not cfg:
    return None

  auth_header = request.headers.get("Authorization")
  if not auth_header or not auth_header.startswith("Bearer "):
    raise HTTPException(status_code=401, detail="Missing Authorization header")

  token = auth_header.split(" ", 1)[1]
  try:
    # In production you should fetch Auth0 JWKS and verify signatures.
    # Here we only decode structure to keep the example lightweight.
    jwt.decode(token, options={"verify_signature": False}, audience=cfg["audience"])
  except JWTError:
    raise HTTPException(status_code=401, detail="Invalid token")


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
  return JSONResponse(
    status_code=500,
    content={"detail": "Internal server error", "error": str(exc)},
  )


@app.get("/health")
def health():
  return {"status": "ok"}


# Mount routers, most patient/AI routes are protected by auth dependency
app.include_router(report_routes.router, dependencies=[Depends(auth_dependency)])
app.include_router(triage_routes.router, dependencies=[Depends(auth_dependency)])
app.include_router(copilot_routes.router, dependencies=[Depends(auth_dependency)])
app.include_router(patient_routes.router, dependencies=[Depends(auth_dependency)])
app.include_router(evidence_routes.router, dependencies=[Depends(auth_dependency)])


if __name__ == "__main__":
  import uvicorn

  uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)

