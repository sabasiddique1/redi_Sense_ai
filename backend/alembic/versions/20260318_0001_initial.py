"""Initial RediSense schema."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from backend.db.types import VectorType


revision = "20260318_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.execute("CREATE EXTENSION IF NOT EXISTS vector")

  op.create_table(
    "patients",
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("mrn", sa.String(length=64), nullable=True),
    sa.Column("name", sa.String(length=255), nullable=False),
    sa.Column("dob", sa.Date(), nullable=True),
    sa.Column("gender", sa.String(length=50), nullable=True),
    sa.Column("primary_clinician", sa.String(length=255), nullable=True),
    sa.Column("history_summary", sa.Text(), nullable=True),
    sa.Column("ai_notes", sa.Text(), nullable=True),
    sa.Column(
      "allergies",
      postgresql.JSONB(astext_type=sa.Text()),
      server_default=sa.text("'[]'::jsonb"),
      nullable=False,
    ),
    sa.Column(
      "conditions",
      postgresql.JSONB(astext_type=sa.Text()),
      server_default=sa.text("'[]'::jsonb"),
      nullable=False,
    ),
    sa.Column(
      "medications",
      postgresql.JSONB(astext_type=sa.Text()),
      server_default=sa.text("'[]'::jsonb"),
      nullable=False,
    ),
    sa.Column(
      "alerts",
      postgresql.JSONB(astext_type=sa.Text()),
      server_default=sa.text("'[]'::jsonb"),
      nullable=False,
    ),
    sa.Column(
      "tasks",
      postgresql.JSONB(astext_type=sa.Text()),
      server_default=sa.text("'[]'::jsonb"),
      nullable=False,
    ),
    sa.Column(
      "profile_metadata",
      postgresql.JSONB(astext_type=sa.Text()),
      server_default=sa.text("'{}'::jsonb"),
      nullable=False,
    ),
    sa.Column(
      "created_at",
      sa.DateTime(timezone=True),
      server_default=sa.text("now()"),
      nullable=False,
    ),
    sa.Column(
      "updated_at",
      sa.DateTime(timezone=True),
      server_default=sa.text("now()"),
      nullable=False,
    ),
    sa.PrimaryKeyConstraint("id", name=op.f("pk_patients")),
    sa.UniqueConstraint("mrn", name=op.f("uq_patients_mrn")),
  )
  op.create_index(op.f("ix_patients_id"), "patients", ["id"], unique=False)

  op.create_table(
    "reports",
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("patient_id", sa.Integer(), nullable=True),
    sa.Column("title", sa.String(length=255), nullable=True),
    sa.Column("modality", sa.String(length=100), nullable=True),
    sa.Column("source_filename", sa.String(length=255), nullable=True),
    sa.Column("mime_type", sa.String(length=100), nullable=True),
    sa.Column("file_size_bytes", sa.Integer(), nullable=True),
    sa.Column("report_text", sa.Text(), nullable=False),
    sa.Column("classification", sa.String(length=255), nullable=True),
    sa.Column("summary", sa.Text(), nullable=True),
    sa.Column(
      "key_findings",
      postgresql.JSONB(astext_type=sa.Text()),
      server_default=sa.text("'[]'::jsonb"),
      nullable=False,
    ),
    sa.Column(
      "structured_data",
      postgresql.JSONB(astext_type=sa.Text()),
      server_default=sa.text("'{}'::jsonb"),
      nullable=False,
    ),
    sa.Column("analysis_model", sa.String(length=100), nullable=True),
    sa.Column("analysis_source", sa.String(length=50), nullable=True),
    sa.Column(
      "created_at",
      sa.DateTime(timezone=True),
      server_default=sa.text("now()"),
      nullable=False,
    ),
    sa.ForeignKeyConstraint(
      ["patient_id"],
      ["patients.id"],
      name=op.f("fk_reports_patient_id_patients"),
      ondelete="SET NULL",
    ),
    sa.PrimaryKeyConstraint("id", name=op.f("pk_reports")),
  )
  op.create_index(op.f("ix_reports_id"), "reports", ["id"], unique=False)
  op.create_index(op.f("ix_reports_patient_id"), "reports", ["patient_id"], unique=False)

  op.create_table(
    "triage_sessions",
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("patient_id", sa.Integer(), nullable=True),
    sa.Column("symptoms", sa.Text(), nullable=False),
    sa.Column("risk_level", sa.String(length=50), nullable=False),
    sa.Column(
      "red_flags",
      postgresql.JSONB(astext_type=sa.Text()),
      server_default=sa.text("'[]'::jsonb"),
      nullable=False,
    ),
    sa.Column("recommended_action", sa.Text(), nullable=False),
    sa.Column("summary", sa.Text(), nullable=False),
    sa.Column(
      "differential",
      postgresql.JSONB(astext_type=sa.Text()),
      server_default=sa.text("'[]'::jsonb"),
      nullable=False,
    ),
    sa.Column("analysis_model", sa.String(length=100), nullable=True),
    sa.Column("analysis_source", sa.String(length=50), nullable=True),
    sa.Column(
      "created_at",
      sa.DateTime(timezone=True),
      server_default=sa.text("now()"),
      nullable=False,
    ),
    sa.ForeignKeyConstraint(
      ["patient_id"],
      ["patients.id"],
      name=op.f("fk_triage_sessions_patient_id_patients"),
      ondelete="SET NULL",
    ),
    sa.PrimaryKeyConstraint("id", name=op.f("pk_triage_sessions")),
  )
  op.create_index(op.f("ix_triage_sessions_id"), "triage_sessions", ["id"], unique=False)
  op.create_index(op.f("ix_triage_sessions_patient_id"), "triage_sessions", ["patient_id"], unique=False)

  op.create_table(
    "timeline_events",
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("patient_id", sa.Integer(), nullable=False),
    sa.Column("event_type", sa.String(length=100), nullable=False),
    sa.Column("title", sa.String(length=255), nullable=False),
    sa.Column("summary", sa.Text(), nullable=False),
    sa.Column(
      "event_metadata",
      postgresql.JSONB(astext_type=sa.Text()),
      server_default=sa.text("'{}'::jsonb"),
      nullable=False,
    ),
    sa.Column(
      "timestamp",
      sa.DateTime(timezone=True),
      server_default=sa.text("now()"),
      nullable=False,
    ),
    sa.ForeignKeyConstraint(
      ["patient_id"],
      ["patients.id"],
      name=op.f("fk_timeline_events_patient_id_patients"),
      ondelete="CASCADE",
    ),
    sa.PrimaryKeyConstraint("id", name=op.f("pk_timeline_events")),
  )
  op.create_index(op.f("ix_timeline_events_event_type"), "timeline_events", ["event_type"], unique=False)
  op.create_index(op.f("ix_timeline_events_id"), "timeline_events", ["id"], unique=False)
  op.create_index(op.f("ix_timeline_events_patient_id"), "timeline_events", ["patient_id"], unique=False)
  op.create_index(op.f("ix_timeline_events_timestamp"), "timeline_events", ["timestamp"], unique=False)

  op.create_table(
    "copilot_conversations",
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("patient_id", sa.Integer(), nullable=True),
    sa.Column("title", sa.String(length=255), nullable=True),
    sa.Column(
      "created_at",
      sa.DateTime(timezone=True),
      server_default=sa.text("now()"),
      nullable=False,
    ),
    sa.Column(
      "updated_at",
      sa.DateTime(timezone=True),
      server_default=sa.text("now()"),
      nullable=False,
    ),
    sa.ForeignKeyConstraint(
      ["patient_id"],
      ["patients.id"],
      name=op.f("fk_copilot_conversations_patient_id_patients"),
      ondelete="SET NULL",
    ),
    sa.PrimaryKeyConstraint("id", name=op.f("pk_copilot_conversations")),
  )
  op.create_index(op.f("ix_copilot_conversations_id"), "copilot_conversations", ["id"], unique=False)
  op.create_index(op.f("ix_copilot_conversations_patient_id"), "copilot_conversations", ["patient_id"], unique=False)

  op.create_table(
    "copilot_messages",
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("conversation_id", sa.Integer(), nullable=False),
    sa.Column("patient_id", sa.Integer(), nullable=True),
    sa.Column("role", sa.String(length=50), nullable=False),
    sa.Column("content", sa.Text(), nullable=False),
    sa.Column(
      "citations",
      postgresql.JSONB(astext_type=sa.Text()),
      server_default=sa.text("'[]'::jsonb"),
      nullable=False,
    ),
    sa.Column(
      "message_metadata",
      postgresql.JSONB(astext_type=sa.Text()),
      server_default=sa.text("'{}'::jsonb"),
      nullable=False,
    ),
    sa.Column(
      "created_at",
      sa.DateTime(timezone=True),
      server_default=sa.text("now()"),
      nullable=False,
    ),
    sa.ForeignKeyConstraint(
      ["conversation_id"],
      ["copilot_conversations.id"],
      name=op.f("fk_copilot_messages_conversation_id_copilot_conversations"),
      ondelete="CASCADE",
    ),
    sa.ForeignKeyConstraint(
      ["patient_id"],
      ["patients.id"],
      name=op.f("fk_copilot_messages_patient_id_patients"),
      ondelete="SET NULL",
    ),
    sa.PrimaryKeyConstraint("id", name=op.f("pk_copilot_messages")),
  )
  op.create_index(op.f("ix_copilot_messages_conversation_id"), "copilot_messages", ["conversation_id"], unique=False)
  op.create_index(op.f("ix_copilot_messages_id"), "copilot_messages", ["id"], unique=False)
  op.create_index(op.f("ix_copilot_messages_patient_id"), "copilot_messages", ["patient_id"], unique=False)

  op.create_table(
    "evidence_documents",
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("source_key", sa.String(length=255), nullable=False),
    sa.Column("title", sa.String(length=255), nullable=False),
    sa.Column("source", sa.String(length=255), nullable=True),
    sa.Column("url", sa.String(length=512), nullable=True),
    sa.Column(
      "document_metadata",
      postgresql.JSONB(astext_type=sa.Text()),
      server_default=sa.text("'{}'::jsonb"),
      nullable=False,
    ),
    sa.Column(
      "created_at",
      sa.DateTime(timezone=True),
      server_default=sa.text("now()"),
      nullable=False,
    ),
    sa.PrimaryKeyConstraint("id", name=op.f("pk_evidence_documents")),
    sa.UniqueConstraint("source_key", name=op.f("uq_evidence_documents_source_key")),
  )
  op.create_index(op.f("ix_evidence_documents_id"), "evidence_documents", ["id"], unique=False)
  op.create_index(op.f("ix_evidence_documents_source_key"), "evidence_documents", ["source_key"], unique=False)

  op.create_table(
    "evidence_chunks",
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("document_id", sa.Integer(), nullable=False),
    sa.Column("chunk_index", sa.Integer(), nullable=False),
    sa.Column("section", sa.String(length=255), nullable=True),
    sa.Column("page", sa.Integer(), nullable=True),
    sa.Column("content", sa.Text(), nullable=False),
    sa.Column("content_hash", sa.String(length=64), nullable=False),
    sa.Column("embedding", VectorType(1536), nullable=False),
    sa.Column(
      "chunk_metadata",
      postgresql.JSONB(astext_type=sa.Text()),
      server_default=sa.text("'{}'::jsonb"),
      nullable=False,
    ),
    sa.Column(
      "created_at",
      sa.DateTime(timezone=True),
      server_default=sa.text("now()"),
      nullable=False,
    ),
    sa.ForeignKeyConstraint(
      ["document_id"],
      ["evidence_documents.id"],
      name=op.f("fk_evidence_chunks_document_id_evidence_documents"),
      ondelete="CASCADE",
    ),
    sa.PrimaryKeyConstraint("id", name=op.f("pk_evidence_chunks")),
    sa.UniqueConstraint("content_hash", name=op.f("uq_evidence_chunks_content_hash")),
  )
  op.create_index(op.f("ix_evidence_chunks_content_hash"), "evidence_chunks", ["content_hash"], unique=False)
  op.create_index(op.f("ix_evidence_chunks_document_chunk"), "evidence_chunks", ["document_id", "chunk_index"], unique=False)
  op.create_index(op.f("ix_evidence_chunks_document_id"), "evidence_chunks", ["document_id"], unique=False)
  op.create_index(op.f("ix_evidence_chunks_id"), "evidence_chunks", ["id"], unique=False)


def downgrade() -> None:
  op.drop_index(op.f("ix_evidence_chunks_id"), table_name="evidence_chunks")
  op.drop_index(op.f("ix_evidence_chunks_document_id"), table_name="evidence_chunks")
  op.drop_index(op.f("ix_evidence_chunks_document_chunk"), table_name="evidence_chunks")
  op.drop_index(op.f("ix_evidence_chunks_content_hash"), table_name="evidence_chunks")
  op.drop_table("evidence_chunks")

  op.drop_index(op.f("ix_evidence_documents_source_key"), table_name="evidence_documents")
  op.drop_index(op.f("ix_evidence_documents_id"), table_name="evidence_documents")
  op.drop_table("evidence_documents")

  op.drop_index(op.f("ix_copilot_messages_patient_id"), table_name="copilot_messages")
  op.drop_index(op.f("ix_copilot_messages_id"), table_name="copilot_messages")
  op.drop_index(op.f("ix_copilot_messages_conversation_id"), table_name="copilot_messages")
  op.drop_table("copilot_messages")

  op.drop_index(op.f("ix_copilot_conversations_patient_id"), table_name="copilot_conversations")
  op.drop_index(op.f("ix_copilot_conversations_id"), table_name="copilot_conversations")
  op.drop_table("copilot_conversations")

  op.drop_index(op.f("ix_timeline_events_timestamp"), table_name="timeline_events")
  op.drop_index(op.f("ix_timeline_events_patient_id"), table_name="timeline_events")
  op.drop_index(op.f("ix_timeline_events_id"), table_name="timeline_events")
  op.drop_index(op.f("ix_timeline_events_event_type"), table_name="timeline_events")
  op.drop_table("timeline_events")

  op.drop_index(op.f("ix_triage_sessions_patient_id"), table_name="triage_sessions")
  op.drop_index(op.f("ix_triage_sessions_id"), table_name="triage_sessions")
  op.drop_table("triage_sessions")

  op.drop_index(op.f("ix_reports_patient_id"), table_name="reports")
  op.drop_index(op.f("ix_reports_id"), table_name="reports")
  op.drop_table("reports")

  op.drop_index(op.f("ix_patients_id"), table_name="patients")
  op.drop_table("patients")
