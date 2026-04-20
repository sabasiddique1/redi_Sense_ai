from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

from backend.db.database import SessionLocal
from backend.services.vector_service import get_vector_service


DEFAULT_BENCHMARK_PATH = Path(__file__).resolve().parents[1] / "evals" / "rag_benchmark.json"


logger = logging.getLogger(__name__)


def _build_parser() -> argparse.ArgumentParser:
  parser = argparse.ArgumentParser(description="Run lightweight retrieval benchmarks.")
  parser.add_argument(
    "--path",
    default=str(DEFAULT_BENCHMARK_PATH),
    help="Path to a JSON benchmark file containing queries and expected_titles.",
  )
  parser.add_argument(
    "--top-k",
    type=int,
    default=3,
    help="Top-k retrieval depth for benchmark evaluation.",
  )
  return parser


def main() -> None:
  logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s level=%(levelname)s logger=%(name)s %(message)s",
  )
  args = _build_parser().parse_args()
  benchmark_path = Path(args.path).resolve()
  cases = json.loads(benchmark_path.read_text(encoding="utf-8"))

  total_cases = 0
  hit_count = 0
  with SessionLocal() as db:
    vector_service = get_vector_service()
    for case in cases:
      total_cases += 1
      query = str(case["query"])
      expected_titles = {str(title) for title in case.get("expected_titles", [])}
      result = vector_service.search(db, query, top_k=args.top_k, dedupe_by_document=True)
      titles = [str(item.get("title") or "") for item in result.results]
      matched = any(title in expected_titles for title in titles)
      hit_count += int(matched)
      logger.info(
        "Benchmark query=%s mode=%s matched=%s retrieved_titles=%s",
        query,
        result.mode,
        matched,
        titles,
      )

  recall_at_k = (hit_count / total_cases) if total_cases else 0.0
  logger.info(
    "RAG evaluation summary cases=%s hits=%s recall_at_%s=%.2f",
    total_cases,
    hit_count,
    args.top_k,
    recall_at_k,
  )


if __name__ == "__main__":
  main()
