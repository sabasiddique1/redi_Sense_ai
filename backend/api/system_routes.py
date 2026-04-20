from fastapi import APIRouter

from backend.config import get_settings
from backend.db.schemas import PublicConfigResponse


router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/config", response_model=PublicConfigResponse)
def get_public_config():
  settings = get_settings()
  return PublicConfigResponse(
    auth_enabled=settings.auth_enabled,
    demo_mode_enabled=settings.demo_mode_enabled,
    openai_chat_model=settings.openai_chat_model,
    openai_embedding_model=settings.openai_embedding_model,
  )
