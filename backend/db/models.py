from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base
from .types import VectorType


class Patient(Base):
  __tablename__ = "patients"

  id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
  mrn: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
  name: Mapped[str] = mapped_column(String(255))
  dob: Mapped[date | None] = mapped_column(Date, nullable=True)
  gender: Mapped[str | None] = mapped_column(String(50), nullable=True)
  primary_clinician: Mapped[str | None] = mapped_column(String(255), nullable=True)
  history_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
  ai_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
  allergies: Mapped[list[str]] = mapped_column(
    JSONB,
    default=list,
    server_default=text("'[]'::jsonb"),
  )
  conditions: Mapped[list[str]] = mapped_column(
    JSONB,
    default=list,
    server_default=text("'[]'::jsonb"),
  )
  medications: Mapped[list[str]] = mapped_column(
    JSONB,
    default=list,
    server_default=text("'[]'::jsonb"),
  )
  alerts: Mapped[list[dict[str, Any]]] = mapped_column(
    JSONB,
    default=list,
    server_default=text("'[]'::jsonb"),
  )
  tasks: Mapped[list[dict[str, Any]]] = mapped_column(
    JSONB,
    default=list,
    server_default=text("'[]'::jsonb"),
  )
  profile_metadata: Mapped[dict[str, Any]] = mapped_column(
    JSONB,
    default=dict,
    server_default=text("'{}'::jsonb"),
  )
  created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(), nullable=False
  )
  updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True),
    server_default=func.now(),
    onupdate=func.now(),
    nullable=False,
  )

  reports: Mapped[list["Report"]] = relationship(
    back_populates="patient",
    cascade="all, delete-orphan",
    order_by="desc(Report.created_at)",
  )
  triage_sessions: Mapped[list["TriageSession"]] = relationship(
    back_populates="patient",
    cascade="all, delete-orphan",
    order_by="desc(TriageSession.created_at)",
  )
  timeline_events: Mapped[list["TimelineEvent"]] = relationship(
    back_populates="patient",
    cascade="all, delete-orphan",
    order_by="desc(TimelineEvent.timestamp)",
  )
  copilot_conversations: Mapped[list["CopilotConversation"]] = relationship(
    back_populates="patient",
    cascade="all, delete-orphan",
    order_by="desc(CopilotConversation.updated_at)",
  )


class Report(Base):
  __tablename__ = "reports"

  id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
  patient_id: Mapped[int | None] = mapped_column(
    ForeignKey("patients.id", ondelete="SET NULL"), nullable=True, index=True
  )
  title: Mapped[str | None] = mapped_column(String(255), nullable=True)
  modality: Mapped[str | None] = mapped_column(String(100), nullable=True)
  source_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
  mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
  file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
  report_text: Mapped[str] = mapped_column(Text)
  classification: Mapped[str | None] = mapped_column(String(255), nullable=True)
  summary: Mapped[str | None] = mapped_column(Text, nullable=True)
  key_findings: Mapped[list[str]] = mapped_column(
    JSONB,
    default=list,
    server_default=text("'[]'::jsonb"),
  )
  structured_data: Mapped[dict[str, Any]] = mapped_column(
    JSONB,
    default=dict,
    server_default=text("'{}'::jsonb"),
  )
  analysis_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
  analysis_source: Mapped[str | None] = mapped_column(String(50), nullable=True)
  created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(), nullable=False
  )

  patient: Mapped["Patient | None"] = relationship(back_populates="reports")


class TriageSession(Base):
  __tablename__ = "triage_sessions"

  id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
  patient_id: Mapped[int | None] = mapped_column(
    ForeignKey("patients.id", ondelete="SET NULL"), nullable=True, index=True
  )
  symptoms: Mapped[str] = mapped_column(Text)
  risk_level: Mapped[str] = mapped_column(String(50))
  red_flags: Mapped[list[str]] = mapped_column(
    JSONB,
    default=list,
    server_default=text("'[]'::jsonb"),
  )
  recommended_action: Mapped[str] = mapped_column(Text)
  summary: Mapped[str] = mapped_column(Text)
  differential: Mapped[list[str]] = mapped_column(
    JSONB,
    default=list,
    server_default=text("'[]'::jsonb"),
  )
  analysis_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
  analysis_source: Mapped[str | None] = mapped_column(String(50), nullable=True)
  created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(), nullable=False
  )

  patient: Mapped["Patient | None"] = relationship(back_populates="triage_sessions")


class TimelineEvent(Base):
  __tablename__ = "timeline_events"

  id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
  patient_id: Mapped[int] = mapped_column(
    ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
  )
  event_type: Mapped[str] = mapped_column(String(100), index=True)
  title: Mapped[str] = mapped_column(String(255))
  summary: Mapped[str] = mapped_column(Text)
  event_metadata: Mapped[dict[str, Any]] = mapped_column(
    JSONB,
    default=dict,
    server_default=text("'{}'::jsonb"),
  )
  timestamp: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(), index=True, nullable=False
  )

  patient: Mapped["Patient"] = relationship(back_populates="timeline_events")


class CopilotConversation(Base):
  __tablename__ = "copilot_conversations"

  id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
  patient_id: Mapped[int | None] = mapped_column(
    ForeignKey("patients.id", ondelete="SET NULL"), nullable=True, index=True
  )
  title: Mapped[str | None] = mapped_column(String(255), nullable=True)
  created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(), nullable=False
  )
  updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True),
    server_default=func.now(),
    onupdate=func.now(),
    nullable=False,
  )

  patient: Mapped["Patient | None"] = relationship(back_populates="copilot_conversations")
  messages: Mapped[list["CopilotMessage"]] = relationship(
    back_populates="conversation",
    cascade="all, delete-orphan",
    order_by="CopilotMessage.created_at",
  )


class CopilotMessage(Base):
  __tablename__ = "copilot_messages"

  id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
  conversation_id: Mapped[int] = mapped_column(
    ForeignKey("copilot_conversations.id", ondelete="CASCADE"),
    nullable=False,
    index=True,
  )
  patient_id: Mapped[int | None] = mapped_column(
    ForeignKey("patients.id", ondelete="SET NULL"), nullable=True, index=True
  )
  role: Mapped[str] = mapped_column(String(50))
  content: Mapped[str] = mapped_column(Text)
  citations: Mapped[list[dict[str, Any]]] = mapped_column(
    JSONB,
    default=list,
    server_default=text("'[]'::jsonb"),
  )
  message_metadata: Mapped[dict[str, Any]] = mapped_column(
    JSONB,
    default=dict,
    server_default=text("'{}'::jsonb"),
  )
  created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(), nullable=False
  )

  conversation: Mapped["CopilotConversation"] = relationship(back_populates="messages")


class EvidenceDocument(Base):
  __tablename__ = "evidence_documents"

  id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
  source_key: Mapped[str] = mapped_column(String(255), unique=True, index=True)
  title: Mapped[str] = mapped_column(String(255))
  source: Mapped[str | None] = mapped_column(String(255), nullable=True)
  url: Mapped[str | None] = mapped_column(String(512), nullable=True)
  document_metadata: Mapped[dict[str, Any]] = mapped_column(
    JSONB,
    default=dict,
    server_default=text("'{}'::jsonb"),
  )
  created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(), nullable=False
  )

  chunks: Mapped[list["EvidenceChunk"]] = relationship(
    back_populates="document",
    cascade="all, delete-orphan",
    order_by="EvidenceChunk.chunk_index",
  )


class EvidenceChunk(Base):
  __tablename__ = "evidence_chunks"

  id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
  document_id: Mapped[int] = mapped_column(
    ForeignKey("evidence_documents.id", ondelete="CASCADE"),
    nullable=False,
    index=True,
  )
  chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
  section: Mapped[str | None] = mapped_column(String(255), nullable=True)
  page: Mapped[int | None] = mapped_column(Integer, nullable=True)
  content: Mapped[str] = mapped_column(Text)
  # search_text denormalizes title/section/content for indexed lexical retrieval.
  search_text: Mapped[str] = mapped_column(
    Text,
    default="",
    server_default=text("''"),
    nullable=False,
  )
  content_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
  embedding: Mapped[str] = mapped_column(VectorType(1536), nullable=False)
  chunk_metadata: Mapped[dict[str, Any]] = mapped_column(
    JSONB,
    default=dict,
    server_default=text("'{}'::jsonb"),
  )
  created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(), nullable=False
  )

  document: Mapped["EvidenceDocument"] = relationship(back_populates="chunks")

  __table_args__ = (
    Index("ix_evidence_chunks_document_chunk", "document_id", "chunk_index"),
  )
