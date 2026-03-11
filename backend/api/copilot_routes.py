from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.schemas import CopilotChatRequest, CopilotChatResponse
from backend.agents.copilot_agent import get_copilot_agent


router = APIRouter(prefix="/api/copilot", tags=["copilot"])


@router.post("/chat", response_model=CopilotChatResponse)
def copilot_chat(payload: CopilotChatRequest, db: Session = Depends(get_db)):
  agent = get_copilot_agent()
  # For now we ignore DB except for future audit logging
  result = agent.chat(payload.message)
  return CopilotChatResponse(**result)

