from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm import selectinload

from backend.db.database import get_db
from backend.db import models
from backend.db.schemas import (
  CopilotChatRequest,
  CopilotChatResponse,
  CopilotConversationResponse,
  CopilotConversationSummary,
)
from backend.agents.copilot_agent import get_copilot_agent


router = APIRouter(prefix="/api/copilot", tags=["copilot"])


@router.post("/chat", response_model=CopilotChatResponse)
def copilot_chat(payload: CopilotChatRequest, db: Session = Depends(get_db)):
  agent = get_copilot_agent()
  result = agent.chat(
    db,
    message=payload.message,
    patient_id=payload.context_patient_id,
    conversation_id=payload.conversation_id,
  )
  return CopilotChatResponse(**result)


@router.get("/conversations", response_model=list[CopilotConversationSummary])
def list_copilot_conversations(
  patient_id: int | None = None,
  limit: int = 8,
  db: Session = Depends(get_db),
):
  safe_limit = min(max(limit, 1), 20)
  query = db.query(models.CopilotConversation).options(
    selectinload(models.CopilotConversation.messages)
  )
  if patient_id is not None:
    query = query.filter(models.CopilotConversation.patient_id == patient_id)

  conversations = (
    query.order_by(models.CopilotConversation.updated_at.desc())
    .limit(safe_limit)
    .all()
  )

  summaries: list[CopilotConversationSummary] = []
  for conversation in conversations:
    latest_message = conversation.messages[-1] if conversation.messages else None
    title = (
      conversation.title
      or (latest_message.content[:80] if latest_message and latest_message.content else None)
      or "Untitled chat"
    )
    preview = (
      latest_message.content[:160]
      if latest_message and latest_message.content
      else None
    )
    summaries.append(
      CopilotConversationSummary(
        id=conversation.id,
        patient_id=conversation.patient_id,
        title=title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        message_count=len(conversation.messages),
        latest_message_preview=preview,
      )
    )

  return summaries


@router.get("/conversations/{conversation_id}", response_model=CopilotConversationResponse)
def get_copilot_conversation(conversation_id: int, db: Session = Depends(get_db)):
  conversation = (
    db.query(models.CopilotConversation)
    .options(selectinload(models.CopilotConversation.messages))
    .filter(models.CopilotConversation.id == conversation_id)
    .first()
  )
  if conversation is None:
    raise HTTPException(status_code=404, detail="Conversation not found")

  return CopilotConversationResponse.model_validate(conversation)
