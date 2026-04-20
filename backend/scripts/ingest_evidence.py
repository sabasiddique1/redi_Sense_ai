from __future__ import annotations

import argparse
import logging
from pathlib import Path

from backend.config import get_settings
from backend.db.database import SessionLocal
from backend.services.vector_service import IngestionSummary, get_vector_service


DEFAULT_EVIDENCE_DIR = Path(__file__).resolve().parents[1] / "sample_data" / "evidence"


logger = logging.getLogger(__name__)
settings = get_settings()


def _build_parser() -> argparse.ArgumentParser:
  parser = argparse.ArgumentParser(
    description="Ingest local evidence documents into Postgres."
  )
  parser.add_argument(
    "--path",
    default=str(DEFAULT_EVIDENCE_DIR),
    help="Directory containing markdown/text evidence documents.",
  )
  parser.add_argument(
    "--batch-size",
    type=int,
    default=settings.embedding_batch_size,
    help="Embedding batch size per OpenAI request.",
  )
  parser.add_argument(
    "--throttle-seconds",
    type=float,
    default=settings.embedding_throttle_seconds,
    help="Delay between embedding batches to reduce rate limits.",
  )
  parser.add_argument(
    "--allow-heuristic-fallback",
    action="store_true",
    help="Use heuristic embeddings when OpenAI embedding retries are exhausted.",
  )
  parser.add_argument(
    "--allow-partial-success",
    action="store_true",
    help="Exit with status 0 even if some chunks still fail after retries.",
  )
  return parser


def _log_summary(summary: IngestionSummary, evidence_dir: Path) -> None:
  logger.info(
    (
      "Evidence ingestion summary path=%s documents_processed=%s documents_succeeded=%s "
      "documents_partial=%s documents_failed=%s total_chunks=%s reused_chunks=%s "
      "successful_embeddings=%s openai_embeddings=%s heuristic_embeddings=%s "
      "failed_embeddings=%s deleted_chunks=%s deferred_cleanup_chunks=%s"
    ),
    evidence_dir,
    summary.documents_processed,
    summary.documents_succeeded,
    summary.documents_partial,
    summary.documents_failed,
    summary.total_chunks,
    summary.reused_chunks,
    summary.successful_embeddings,
    summary.openai_embeddings,
    summary.heuristic_embeddings,
    summary.failed_embeddings,
    summary.deleted_chunks,
    summary.deferred_cleanup_chunks,
  )

  for document in summary.documents:
    if not document.errors:
      continue
    logger.warning(
      "Evidence ingestion document issues path=%s status=%s errors=%s",
      document.path,
      document.status,
      document.errors,
    )


def main() -> None:
  logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s level=%(levelname)s logger=%(name)s %(message)s",
  )
  args = _build_parser().parse_args()

  evidence_dir = Path(args.path).resolve()
  if not evidence_dir.exists():
    raise SystemExit(f"Evidence directory not found: {evidence_dir}")

  with SessionLocal() as db:
    summary = get_vector_service().ingest_directory(
      db,
      evidence_dir,
      allow_heuristic_fallback=args.allow_heuristic_fallback,
      throttle_seconds=args.throttle_seconds,
      batch_size=args.batch_size,
    )

  _log_summary(summary, evidence_dir)

  if summary.failed_embeddings or summary.documents_failed:
    message = (
      "Evidence ingestion completed with failures: "
      f"documents_processed={summary.documents_processed}, "
      f"failed_embeddings={summary.failed_embeddings}, "
      f"documents_failed={summary.documents_failed}"
    )
    if args.allow_partial_success:
      logger.warning(message)
      return
    raise SystemExit(message)

  logger.info(
    "Evidence ingestion completed successfully path=%s documents_processed=%s total_chunks=%s successful_embeddings=%s reused_chunks=%s",
    evidence_dir,
    summary.documents_processed,
    summary.total_chunks,
    summary.successful_embeddings,
    summary.reused_chunks,
  )


if __name__ == "__main__":
  main()
