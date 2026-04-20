"""Add denormalized search text and retrieval indexes for evidence chunks."""

from alembic import op
import sqlalchemy as sa


revision = "20260406_0002"
down_revision = "20260318_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.add_column(
    "evidence_chunks",
    sa.Column(
      "search_text",
      sa.Text(),
      nullable=False,
      server_default=sa.text("''"),
    ),
  )

  op.execute(
    """
    UPDATE evidence_chunks AS c
    SET search_text = trim(
      concat_ws(
        E'\n',
        d.title,
        coalesce(c.section, ''),
        c.content
      )
    )
    FROM evidence_documents AS d
    WHERE d.id = c.document_id
    """
  )

  op.execute(
    """
    CREATE INDEX IF NOT EXISTS ix_evidence_chunks_search_text_fts
    ON evidence_chunks
    USING gin (to_tsvector('simple', coalesce(search_text, '')))
    """
  )
  op.execute(
    """
    CREATE INDEX IF NOT EXISTS ix_evidence_chunks_embedding_ivfflat
    ON evidence_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
    """
  )
  op.execute("ANALYZE evidence_chunks")


def downgrade() -> None:
  op.execute("DROP INDEX IF EXISTS ix_evidence_chunks_embedding_ivfflat")
  op.execute("DROP INDEX IF EXISTS ix_evidence_chunks_search_text_fts")
  op.drop_column("evidence_chunks", "search_text")
