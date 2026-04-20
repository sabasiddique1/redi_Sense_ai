from __future__ import annotations

from functools import lru_cache
import logging

from fastapi import HTTPException, Request
from jwt import PyJWKClient, decode
from jwt.exceptions import InvalidTokenError

from backend.config import get_settings


logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
  settings = get_settings()
  assert settings.auth0_domain is not None
  return PyJWKClient(f"https://{settings.auth0_domain}/.well-known/jwks.json")


def get_auth0_public_config() -> dict[str, str] | None:
  settings = get_settings()
  if not settings.auth_enabled:
    return None

  return {
    "audience": settings.auth0_audience or "",
    "issuer": settings.auth0_issuer or "",
    "domain": settings.auth0_domain or "",
  }


async def auth_dependency(request: Request) -> dict[str, object] | None:
  settings = get_settings()
  if not settings.auth_enabled:
    # Keep local development unblocked until Auth0 variables are supplied.
    return None

  auth_header = request.headers.get("Authorization")
  if not auth_header or not auth_header.startswith("Bearer "):
    raise HTTPException(status_code=401, detail="Missing Authorization header")

  token = auth_header.split(" ", 1)[1]
  try:
    signing_key = _jwks_client().get_signing_key_from_jwt(token)
    claims = decode(
      token,
      signing_key.key,
      algorithms=settings.auth0_algorithms,
      audience=settings.auth0_audience,
      issuer=settings.auth0_issuer,
    )
  except InvalidTokenError as exc:
    logger.warning("JWT verification failed: %s", exc.__class__.__name__)
    raise HTTPException(status_code=401, detail="Invalid token") from exc

  request.state.auth = claims
  return claims
