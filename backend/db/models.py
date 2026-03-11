from datetime import datetime

from sqlalchemy import (
  Column,
  Date,
  DateTime,
  Enum,
  ForeignKey,
  Integer,
  String,
  Text,
)
from sqlalchemy.orm import relationship, Mapped

from .database import Base


class User(Base):
  __tablename__ = "users"

  id: Mapped[int] = Column(Integer, primary_key=True, index=True)
  auth0_sub: Mapped[str] = Column(String(255), unique=True, index=True)
  email: Mapped[str | None] = Column(String(255), index=True, nullable=True)
  name: Mapped[str | None] = Column(String(255), nullable=True)
  created_at: Mapped[datetime] = Column(
    DateTime(timezone=True), default=datetime.utcnow
  )

  patients = relationship("Patient", back_populates="owner")


class Patient(Base):
  __tablename__ = "patients"

  id: Mapped[int] = Column(Integer, primary_key=True, index=True)
  owner_id: Mapped[int | None] = Column(Integer, ForeignKey("users.id"))
  name: Mapped[str] = Column(String(255))
  dob: Mapped[datetime | None] = Column(Date, nullable=True)
  gender: Mapped[str | None] = Column(String(50), nullable=True)
  created_at: Mapped[datetime] = Column(
    DateTime(timezone=True), default=datetime.utcnow
  )

  owner = relationship("User", back_populates="patients")
  reports = relationship("MedicalReport", back_populates="patient")
  triage_sessions = relationship("TriageSession", back_populates="patient")
  timeline_events = relationship("TimelineEvent", back_populates="patient")


class MedicalReport(Base):
  __tablename__ = "medical_reports"

  id: Mapped[int] = Column(Integer, primary_key=True, index=True)
  patient_id: Mapped[int] = Column(Integer, ForeignKey("patients.id"))
  report_text: Mapped[str] = Column(Text)
  classification: Mapped[str | None] = Column(String(255), nullable=True)
  created_at: Mapped[datetime] = Column(
    DateTime(timezone=True), default=datetime.utcnow
  )

  patient = relationship("Patient", back_populates="reports")
  ai_responses = relationship("AIResponse", back_populates="report")


class TriageSession(Base):
  __tablename__ = "triage_sessions"

  id: Mapped[int] = Column(Integer, primary_key=True, index=True)
  patient_id: Mapped[int | None] = Column(Integer, ForeignKey("patients.id"))
  symptoms: Mapped[str] = Column(Text)
  risk_level: Mapped[str | None] = Column(String(50), nullable=True)
  created_at: Mapped[datetime] = Column(
    DateTime(timezone=True), default=datetime.utcnow
  )

  patient = relationship("Patient", back_populates="triage_sessions")
  ai_responses = relationship("AIResponse", back_populates="triage_session")


class TimelineEvent(Base):
  __tablename__ = "timeline_events"

  id: Mapped[int] = Column(Integer, primary_key=True, index=True)
  patient_id: Mapped[int] = Column(Integer, ForeignKey("patients.id"))
  event_type: Mapped[str] = Column(String(50))
  description: Mapped[str] = Column(Text)
  timestamp: Mapped[datetime] = Column(
    DateTime(timezone=True), default=datetime.utcnow, index=True
  )

  patient = relationship("Patient", back_populates="timeline_events")


class AIResponse(Base):
  __tablename__ = "ai_responses"

  id: Mapped[int] = Column(Integer, primary_key=True, index=True)
  user_id: Mapped[int | None] = Column(Integer, ForeignKey("users.id"))
  report_id: Mapped[int | None] = Column(Integer, ForeignKey("medical_reports.id"))
  triage_session_id: Mapped[int | None] = Column(
    Integer, ForeignKey("triage_sessions.id")
  )
  role: Mapped[str] = Column(String(50))  # e.g. report_analysis, triage, summary
  request_text: Mapped[str] = Column(Text)
  response_text: Mapped[str] = Column(Text)
  created_at: Mapped[datetime] = Column(
    DateTime(timezone=True), default=datetime.utcnow
  )

  report = relationship("MedicalReport", back_populates="ai_responses")
  triage_session = relationship("TriageSession", back_populates="ai_responses")


class AuditLog(Base):
  __tablename__ = "audit_logs"

  id: Mapped[int] = Column(Integer, primary_key=True, index=True)
  user_id: Mapped[int | None] = Column(Integer, ForeignKey("users.id"))
  action: Mapped[str] = Column(String(255))
  resource_type: Mapped[str | None] = Column(String(100), nullable=True)
  resource_id: Mapped[str | None] = Column(String(100), nullable=True)
  timestamp: Mapped[datetime] = Column(
    DateTime(timezone=True), default=datetime.utcnow, index=True
  )
  detail: Mapped[str | None] = Column(Text, nullable=True)

