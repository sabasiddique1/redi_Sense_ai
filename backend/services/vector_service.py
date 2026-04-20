from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import hashlib
import logging
from pathlib import Path
import re
import time
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.config import get_settings
from backend.db import models
from backend.db.types import vector_literal
from backend.services.openai_service import get_ai_provider


logger = logging.getLogger(__name__)
settings = get_settings()

_QUERY_STOP_WORDS = {
  "a",
  "an",
  "and",
  "for",
  "guideline",
  "guidelines",
  "help",
  "in",
  "information",
  "management",
  "of",
  "on",
  "review",
  "summarize",
  "summary",
  "the",
  "to",
  "what",
}
_PHRASE_EXPANSIONS: dict[str, tuple[str, ...]] = {
  "chest pain": ("acute chest pain", "arm radiation", "diaphoresis", "dyspnea", "ecg"),
  "clinical decision support": ("decision support", "clinical support safety"),
  "pulmonary nodule": ("lung nodule", "pet ct", "spiculation"),
  "pneumonia": ("lung infection", "consolidation", "productive cough", "fever"),
}
_TOKEN_EXPANSIONS: dict[str, tuple[str, ...]] = {
  "cardiac": ("heart",),
  "chest": ("thoracic",),
  "dyspnea": ("shortness", "breath",),
  "nodule": ("nodules", "lesion"),
  "pulmonary": ("lung",),
  "pneumonia": ("infectious", "consolidation", "cough", "fever"),
}


@dataclass(frozen=True)
class SearchQueryProfile:
  raw_query: str
  normalized_query: str
  primary_terms: tuple[str, ...]
  expanded_terms: tuple[str, ...]
  expanded_phrases: tuple[str, ...]


@dataclass(frozen=True)
class RetrievalFilters:
  sources: tuple[str, ...] = ()
  document_ids: tuple[int, ...] = ()
  section_query: str | None = None


@dataclass
class RankedEvidenceCandidate:
  id: str
  document_id: int
  title: str
  text: str
  source: str | None
  url: str | None
  section: str | None
  page: int | None
  lexical_score: float
  vector_score: float | None = None
  rerank_score: float | None = None

  @property
  def score(self) -> float:
    if self.rerank_score is not None:
      return round(max(0.0, min(self.rerank_score, 1.0)), 6)
    if self.vector_score is None:
      return round(max(0.0, min(self.lexical_score, 1.0)), 6)
    blended = (self.vector_score * 0.65) + (self.lexical_score * 0.35)
    return round(max(0.0, min(blended, 1.0)), 6)

  def to_result(self) -> dict[str, Any]:
    return {
      "id": self.id,
      "document_id": self.document_id,
      "title": self.title,
      "text": self.text,
      "source": self.source,
      "url": self.url,
      "section": self.section,
      "page": self.page,
      "score": self.score,
      "lexical_score": self.lexical_score,
      "vector_score": self.vector_score,
    }


@dataclass
class EvidenceSearchOutcome:
  results: list[dict[str, Any]]
  mode: str
  ai_mode: str | None
  latency_ms: int
  error_message: str | None = None
  normalized_query: str | None = None
  fallback_reason: str | None = None
  trace: dict[str, Any] | None = None


def _normalize_search_text(text_content: str) -> str:
  normalized = re.sub(r"[^a-z0-9\s-]+", " ", text_content.lower())
  normalized = normalized.replace("-", " ")
  return re.sub(r"\s+", " ", normalized).strip()


def _dedupe_preserve_order(items: list[str]) -> tuple[str, ...]:
  seen: set[str] = set()
  deduped: list[str] = []
  for item in items:
    cleaned = item.strip()
    if not cleaned or cleaned in seen:
      continue
    seen.add(cleaned)
    deduped.append(cleaned)
  return tuple(deduped)


def _estimate_tokens(text_content: str) -> int:
  return max(1, len(re.findall(r"\S+", text_content)))


def _safe_websearch_query(profile: SearchQueryProfile) -> str:
  parts: list[str] = []
  for phrase in list(profile.expanded_phrases)[: settings.evidence_keyword_filter_limit]:
    cleaned = _normalize_search_text(phrase)
    if not cleaned:
      continue
    parts.append(f"\"{cleaned}\"" if " " in cleaned else cleaned)

  for term in list(profile.expanded_terms)[: settings.evidence_keyword_filter_limit]:
    cleaned = _normalize_search_text(term)
    if cleaned:
      parts.append(cleaned)

  deduped = _dedupe_preserve_order(parts)
  return " OR ".join(deduped) if deduped else profile.normalized_query


@dataclass
class ParsedDocument:
  title: str
  source: str | None
  url: str | None
  section: str | None
  page: int | None
  content: str


@dataclass(frozen=True)
class ChunkCandidate:
  chunk_index: int
  section: str | None
  token_count: int
  content: str
  search_text: str
  content_hash: str


@dataclass
class DocumentIngestionResult:
  path: Path
  document_id: int | None = None
  title: str | None = None
  total_chunks: int = 0
  reused_chunks: int = 0
  openai_chunks: int = 0
  heuristic_chunks: int = 0
  failed_chunks: int = 0
  deleted_chunks: int = 0
  deferred_cleanup_chunks: int = 0
  errors: list[str] = field(default_factory=list)
  fatal_error: str | None = None

  @property
  def successful_embeddings(self) -> int:
    return self.openai_chunks + self.heuristic_chunks

  @property
  def available_chunks(self) -> int:
    return self.reused_chunks + self.successful_embeddings

  @property
  def status(self) -> str:
    if self.fatal_error:
      return "failed"
    if self.failed_chunks:
      return "partial"
    return "success"


@dataclass
class IngestionSummary:
  documents: list[DocumentIngestionResult] = field(default_factory=list)

  @property
  def documents_processed(self) -> int:
    return len(self.documents)

  @property
  def documents_succeeded(self) -> int:
    return sum(1 for document in self.documents if document.status == "success")

  @property
  def documents_failed(self) -> int:
    return sum(1 for document in self.documents if document.status == "failed")

  @property
  def documents_partial(self) -> int:
    return sum(1 for document in self.documents if document.status == "partial")

  @property
  def total_chunks(self) -> int:
    return sum(document.total_chunks for document in self.documents)

  @property
  def reused_chunks(self) -> int:
    return sum(document.reused_chunks for document in self.documents)

  @property
  def successful_embeddings(self) -> int:
    return sum(document.successful_embeddings for document in self.documents)

  @property
  def openai_embeddings(self) -> int:
    return sum(document.openai_chunks for document in self.documents)

  @property
  def heuristic_embeddings(self) -> int:
    return sum(document.heuristic_chunks for document in self.documents)

  @property
  def failed_embeddings(self) -> int:
    return sum(document.failed_chunks for document in self.documents)

  @property
  def deleted_chunks(self) -> int:
    return sum(document.deleted_chunks for document in self.documents)

  @property
  def deferred_cleanup_chunks(self) -> int:
    return sum(document.deferred_cleanup_chunks for document in self.documents)


class VectorService:
  def __init__(self):
    self.ai = get_ai_provider()

  def _build_query_profile(self, query: str) -> SearchQueryProfile:
    normalized_query = _normalize_search_text(query)
    primary_terms = [
      token
      for token in normalized_query.split()
      if len(token) > 1 and token not in _QUERY_STOP_WORDS
    ]
    expanded_terms = list(primary_terms)
    expanded_phrases = [normalized_query] if normalized_query else []

    for phrase, expansions in _PHRASE_EXPANSIONS.items():
      if phrase in normalized_query:
        expanded_phrases.extend(expansions)
        for expansion in expansions:
          expanded_terms.extend(_normalize_search_text(expansion).split())

    for term in list(primary_terms):
      expanded_terms.extend(_TOKEN_EXPANSIONS.get(term, ()))

    return SearchQueryProfile(
      raw_query=query,
      normalized_query=normalized_query,
      primary_terms=_dedupe_preserve_order(primary_terms),
      expanded_terms=_dedupe_preserve_order(
        [term for term in expanded_terms if term and term not in _QUERY_STOP_WORDS]
      ),
      expanded_phrases=_dedupe_preserve_order(expanded_phrases),
    )

  def _coerce_filters(self, filters: RetrievalFilters | dict[str, Any] | None) -> RetrievalFilters:
    if isinstance(filters, RetrievalFilters):
      return filters
    if not isinstance(filters, dict):
      return RetrievalFilters()

    sources = tuple(
      str(value).strip()
      for value in filters.get("sources", [])
      if str(value).strip()
    )
    document_ids = tuple(
      int(value)
      for value in filters.get("document_ids", [])
      if isinstance(value, int) or (isinstance(value, str) and value.isdigit())
    )
    section_query = str(filters.get("section_query")).strip() if filters.get("section_query") else None
    return RetrievalFilters(
      sources=sources,
      document_ids=document_ids,
      section_query=section_query,
    )

  def _score_text_match(
    self,
    profile: SearchQueryProfile,
    *,
    title: str,
    section: str | None,
    content: str,
  ) -> float:
    title_text = _normalize_search_text(title)
    section_text = _normalize_search_text(section or "")
    content_text = _normalize_search_text(content)
    title_tokens = set(title_text.split())
    section_tokens = set(section_text.split())
    content_tokens = set(content_text.split())

    score = 0.0
    matched_primary_terms = 0
    for phrase in profile.expanded_phrases:
      if not phrase:
        continue
      if phrase == profile.normalized_query and phrase in title_text:
        score += 0.38
      elif phrase == profile.normalized_query and phrase in section_text:
        score += 0.26
      elif phrase == profile.normalized_query and phrase in content_text:
        score += 0.18
      elif phrase in title_text:
        score += 0.12
      elif phrase in section_text:
        score += 0.08
      elif phrase in content_text:
        score += 0.05

    for term in profile.primary_terms:
      matched = False
      if term in title_tokens:
        score += 0.14
        matched = True
      if term in section_tokens:
        score += 0.10
        matched = True
      if term in content_tokens:
        score += 0.08
        matched = True
      if matched:
        matched_primary_terms += 1

    for term in profile.expanded_terms:
      if term in title_tokens:
        score += 0.05
      elif term in section_tokens:
        score += 0.03
      elif term in content_tokens:
        score += 0.02

    if profile.primary_terms:
      coverage = matched_primary_terms / len(profile.primary_terms)
      score += coverage * 0.2
      if coverage == 1.0:
        score += 0.08

    return round(max(0.0, min(score, 1.0)), 6)

  def _load_search_rows(self, db: Session) -> list[dict[str, Any]]:
    rows = (
      db.query(models.EvidenceChunk, models.EvidenceDocument)
      .join(
        models.EvidenceDocument,
        models.EvidenceDocument.id == models.EvidenceChunk.document_id,
      )
      .all()
    )
    return [
      {
        "id": str(chunk.id),
        "document_id": document.id,
        "title": document.title,
        "text": chunk.content,
        "source": document.source,
        "url": document.url,
        "section": chunk.section,
        "page": chunk.page,
      }
      for chunk, document in rows
    ]

  def _rank_rows(
    self,
    rows: list[dict[str, Any]],
    profile: SearchQueryProfile,
  ) -> dict[str, RankedEvidenceCandidate]:
    ranked: dict[str, RankedEvidenceCandidate] = {}
    for row in rows:
      lexical_score = self._score_text_match(
        profile,
        title=str(row["title"] or ""),
        section=row.get("section"),
        content=str(row["text"] or ""),
      )
      if lexical_score <= 0:
        continue

      candidate = RankedEvidenceCandidate(
        id=str(row["id"]),
        document_id=int(row["document_id"]),
        title=str(row["title"] or "Untitled evidence"),
        text=str(row["text"] or ""),
        source=row.get("source"),
        url=row.get("url"),
        section=row.get("section"),
        page=row.get("page"),
        lexical_score=lexical_score,
      )
      existing = ranked.get(candidate.id)
      if existing is None or candidate.lexical_score > existing.lexical_score:
        ranked[candidate.id] = candidate
    return ranked

  def _build_lexical_candidates(
    self,
    db: Session,
    *,
    profile: SearchQueryProfile,
    started_at: float,
    filters: RetrievalFilters,
  ) -> tuple[dict[str, RankedEvidenceCandidate], str]:
    # Use indexed full-text search first and keep the Python scorer only as a fallback path.
    remaining_timeout_ms = self._remaining_timeout_ms(started_at)
    if remaining_timeout_ms < 250:
      return {}, "timeout"

    query_text = _safe_websearch_query(profile)
    base_sql = """
      SELECT
        c.id,
        c.document_id,
        c.content AS text,
        c.section,
        c.page,
        d.title,
        d.source,
        d.url,
        ts_rank_cd(
          to_tsvector('simple', coalesce(c.search_text, c.content)),
          websearch_to_tsquery('simple', :lexical_query)
        ) AS lexical_score
      FROM evidence_chunks AS c
      JOIN evidence_documents AS d ON d.id = c.document_id
      WHERE to_tsvector('simple', coalesce(c.search_text, c.content))
        @@ websearch_to_tsquery('simple', :lexical_query)
    """

    params: dict[str, Any] = {
      "lexical_query": query_text,
      "limit": settings.evidence_lexical_candidate_limit,
    }
    clauses: list[str] = []
    if filters.sources:
      params["sources"] = list(filters.sources)
      clauses.append("d.source = ANY(CAST(:sources AS text[]))")
    if filters.document_ids:
      params["document_ids"] = list(filters.document_ids)
      clauses.append("c.document_id = ANY(CAST(:document_ids AS integer[]))")
    if filters.section_query:
      params["section_query"] = f"%{filters.section_query.lower()}%"
      clauses.append("LOWER(coalesce(c.section, '')) LIKE :section_query")
    if clauses:
      base_sql += " AND " + " AND ".join(clauses)
    base_sql += " ORDER BY lexical_score DESC, c.id ASC LIMIT :limit"

    try:
      self._set_statement_timeout(
        db,
        min(settings.evidence_db_statement_timeout_ms, remaining_timeout_ms),
      )
      rows = db.execute(text(base_sql), params).mappings()
      ranked: dict[str, RankedEvidenceCandidate] = {}
      for row in rows:
        lexical_score = round(max(0.0, min(float(row.get("lexical_score") or 0.0), 1.0)), 6)
        if lexical_score <= 0:
          continue
        candidate = RankedEvidenceCandidate(
          id=str(row["id"]),
          document_id=int(row["document_id"]),
          title=str(row["title"] or "Untitled evidence"),
          text=str(row["text"] or ""),
          source=row.get("source"),
          url=row.get("url"),
          section=row.get("section"),
          page=row.get("page"),
          lexical_score=lexical_score,
        )
        ranked[candidate.id] = candidate
      return ranked, "fts"
    except Exception:
      logger.debug("Falling back to Python lexical ranking", exc_info=True)
      rows = self._load_search_rows(db)
      if filters.sources:
        rows = [row for row in rows if row.get("source") in filters.sources]
      if filters.document_ids:
        rows = [row for row in rows if int(row.get("document_id", 0)) in filters.document_ids]
      if filters.section_query:
        section_query = filters.section_query.lower()
        rows = [
          row for row in rows
          if section_query in str(row.get("section") or "").lower()
        ]
      return self._rank_rows(rows, profile), "python"

  def _heuristic_rerank(
    self,
    candidates: list[RankedEvidenceCandidate],
    *,
    profile: SearchQueryProfile,
  ) -> list[RankedEvidenceCandidate]:
    if not settings.evidence_enable_heuristic_rerank:
      return candidates

    seen_signatures: set[str] = set()
    for candidate in candidates:
      rerank_score = candidate.score
      normalized_text = _normalize_search_text(candidate.text)
      normalized_title = _normalize_search_text(candidate.title)
      if profile.normalized_query and profile.normalized_query in normalized_title:
        rerank_score += 0.08
      elif profile.normalized_query and profile.normalized_query in normalized_text:
        rerank_score += 0.04
      if candidate.section:
        normalized_section = _normalize_search_text(candidate.section)
        if any(term in normalized_section for term in profile.primary_terms[:4]):
          rerank_score += 0.03
      signature = normalized_text[:220]
      if signature in seen_signatures:
        rerank_score -= 0.05
      else:
        seen_signatures.add(signature)
      candidate.rerank_score = round(max(0.0, min(rerank_score, 1.0)), 6)

    return sorted(
      candidates,
      key=lambda item: (item.score, item.lexical_score, item.title.lower()),
      reverse=True,
    )

  def _remaining_timeout_ms(self, started_at: float) -> int:
    elapsed = time.perf_counter() - started_at
    remaining_seconds = max(settings.evidence_search_timeout_seconds - elapsed, 0.0)
    return int(remaining_seconds * 1000)

  def _set_statement_timeout(self, db: Session, timeout_ms: int) -> None:
    if timeout_ms <= 0:
      return
    try:
      db.execute(text("SET LOCAL statement_timeout = :timeout_ms"), {"timeout_ms": timeout_ms})
    except Exception:
      logger.debug("Unable to set statement timeout for evidence query", exc_info=True)

  def _normalize_vector_score(self, raw_score: float | None) -> float:
    if raw_score is None:
      return 0.0
    return round(max(0.0, min(float(raw_score), 1.0)), 6)

  def _run_vector_query(
    self,
    db: Session,
    *,
    embedding: list[float],
    started_at: float,
    filters: RetrievalFilters,
  ) -> list[dict[str, Any]]:
    remaining_timeout_ms = self._remaining_timeout_ms(started_at)
    if remaining_timeout_ms < 250:
      raise TimeoutError("Evidence search exceeded the configured time budget before vector ranking.")

    self._set_statement_timeout(
      db,
      min(settings.evidence_db_statement_timeout_ms, remaining_timeout_ms),
    )
    query_literal = vector_literal(embedding)
    params: dict[str, Any] = {
      "embedding": query_literal,
      "limit": settings.evidence_vector_candidate_limit,
    }
    where_clauses: list[str] = []
    if filters.sources:
      params["sources"] = list(filters.sources)
      where_clauses.append("d.source = ANY(CAST(:sources AS text[]))")
    if filters.document_ids:
      params["document_ids"] = list(filters.document_ids)
      where_clauses.append("c.document_id = ANY(CAST(:document_ids AS integer[]))")
    if filters.section_query:
      params["section_query"] = f"%{filters.section_query.lower()}%"
      where_clauses.append("LOWER(coalesce(c.section, '')) LIKE :section_query")
    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    rows = db.execute(
      text(
        f"""
        SELECT
          c.id,
          c.document_id,
          c.content,
          c.section,
          c.page,
          d.title,
          d.source,
          d.url,
          1 - (c.embedding <=> CAST(:embedding AS vector)) AS score
        FROM evidence_chunks AS c
        JOIN evidence_documents AS d ON d.id = c.document_id
        {where_sql}
        ORDER BY c.embedding <=> CAST(:embedding AS vector)
        LIMIT :limit
        """
      ),
      params,
    ).mappings()
    return [dict(row) for row in rows]

  def _finalize_candidates(
    self,
    candidates: list[RankedEvidenceCandidate],
    *,
    profile: SearchQueryProfile,
    top_k: int,
    dedupe_by_document: bool,
  ) -> list[dict[str, Any]]:
    ordered = self._heuristic_rerank(candidates, profile=profile)

    if not dedupe_by_document:
      return [candidate.to_result() for candidate in ordered[:top_k]]

    best_by_document: dict[int, RankedEvidenceCandidate] = {}
    for candidate in ordered:
      existing = best_by_document.get(candidate.document_id)
      if existing is None or candidate.score > existing.score:
        best_by_document[candidate.document_id] = candidate

    return [
      candidate.to_result()
      for candidate in sorted(
        best_by_document.values(),
        key=lambda item: (item.score, item.lexical_score, item.title.lower()),
        reverse=True,
      )[:top_k]
    ]

  def _build_trace(
    self,
    *,
    profile: SearchQueryProfile,
    mode: str,
    ai_mode: str | None,
    fallback_reason: str | None,
    lexical_strategy: str,
    filters: RetrievalFilters,
    selected_results: list[dict[str, Any]],
  ) -> dict[str, Any]:
    return {
      "query": profile.raw_query,
      "normalized_query": profile.normalized_query,
      "lexical_strategy": lexical_strategy,
      "mode": mode,
      "ai_mode": ai_mode,
      "fallback_reason": fallback_reason,
      "filters": {
        "sources": list(filters.sources),
        "document_ids": list(filters.document_ids),
        "section_query": filters.section_query,
      },
      "selected_chunks": [
        {
          "chunk_id": result["id"],
          "document_id": result["document_id"],
          "title": result["title"],
          "section": result.get("section"),
          "score": result.get("score"),
          "lexical_score": result.get("lexical_score"),
          "vector_score": result.get("vector_score"),
        }
        for result in selected_results
      ],
    }

  def _chunk_paragraphs(
    self,
    paragraphs: list[str],
    *,
    section_name: str | None,
  ) -> list[tuple[str | None, str, int]]:
    chunk_size_tokens = settings.evidence_chunk_size_tokens
    overlap_tokens = settings.evidence_chunk_overlap_tokens
    paragraph_units: list[tuple[str, int]] = []

    for paragraph in paragraphs:
      cleaned = re.sub(r"\s+", " ", paragraph).strip()
      if not cleaned:
        continue
      token_count = _estimate_tokens(cleaned)
      if token_count <= chunk_size_tokens:
        paragraph_units.append((cleaned, token_count))
        continue

      sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+", cleaned)
        if sentence.strip()
      ] or [cleaned]
      sentence_buffer: list[str] = []
      sentence_tokens = 0
      for sentence in sentences:
        current_tokens = _estimate_tokens(sentence)
        if sentence_buffer and sentence_tokens + current_tokens > chunk_size_tokens:
          combined = " ".join(sentence_buffer).strip()
          paragraph_units.append((combined, _estimate_tokens(combined)))
          sentence_buffer = []
          sentence_tokens = 0
        sentence_buffer.append(sentence)
        sentence_tokens += current_tokens
      if sentence_buffer:
        combined = " ".join(sentence_buffer).strip()
        paragraph_units.append((combined, _estimate_tokens(combined)))

    chunks: list[tuple[str | None, str, int]] = []
    start_index = 0
    while start_index < len(paragraph_units):
      current_units: list[tuple[str, int]] = []
      current_tokens = 0
      index = start_index
      while index < len(paragraph_units):
        paragraph_text, token_count = paragraph_units[index]
        if current_units and current_tokens + token_count > chunk_size_tokens:
          break
        current_units.append((paragraph_text, token_count))
        current_tokens += token_count
        index += 1

      if not current_units:
        break

      chunk_text = "\n\n".join(text_content for text_content, _ in current_units).strip()
      chunks.append((section_name, chunk_text, current_tokens))
      if index >= len(paragraph_units):
        break

      overlap_unit_count = 0
      overlap_accumulator = 0
      for paragraph_text, token_count in reversed(current_units):
        overlap_accumulator += token_count
        overlap_unit_count += 1
        if overlap_accumulator >= overlap_tokens:
          break
      start_index = max(index - overlap_unit_count, start_index + 1)

    return chunks

  def _chunk_text(self, text_content: str, *, default_section: str | None = None) -> list[tuple[str | None, str, int]]:
    # Chunk by markdown section/paragraph with approximate token budgets instead of raw characters.
    normalized = re.sub(r"\n{3,}", "\n\n", text_content).strip()
    if not normalized:
      return []

    section_pattern = re.compile(r"(?m)^(#{1,6})\s+(?P<title>.+?)\s*$")
    matches = list(section_pattern.finditer(normalized))
    section_blocks: list[tuple[str | None, str]] = []
    if matches:
      for index, match in enumerate(matches):
        title = re.sub(r"\s+", " ", match.group("title")).strip()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(normalized)
        content = normalized[start:end].strip()
        if content:
          section_blocks.append((title, content))
    else:
      section_blocks.append((default_section, normalized))

    chunks: list[tuple[str | None, str, int]] = []
    for section_name, block in section_blocks:
      paragraphs = [part.strip() for part in re.split(r"\n\s*\n", block) if part.strip()]
      chunks.extend(self._chunk_paragraphs(paragraphs, section_name=section_name or default_section))
    return chunks

  def parse_document(self, path: Path) -> ParsedDocument:
    raw = path.read_text(encoding="utf-8", errors="ignore").strip()
    title = path.stem.replace("-", " ").title()
    source = None
    url = None
    section = None
    page = None
    content = raw

    if raw.startswith("---"):
      _, frontmatter, remainder = raw.split("---", 2)
      metadata: dict[str, str] = {}
      for line in frontmatter.splitlines():
        if ":" not in line:
          continue
        key, value = line.split(":", 1)
        metadata[key.strip()] = value.strip().strip('"')
      title = metadata.get("title", title)
      source = metadata.get("source")
      url = metadata.get("url")
      section = metadata.get("section")
      page_value = metadata.get("page")
      page = int(page_value) if page_value and page_value.isdigit() else None
      content = remainder.strip()

    return ParsedDocument(
      title=title,
      source=source,
      url=url,
      section=section,
      page=page,
      content=content,
    )

  def _build_chunk_candidates(
    self,
    source_key: str,
    *,
    title: str,
    chunks: list[tuple[str | None, str, int]],
  ) -> list[ChunkCandidate]:
    return [
      ChunkCandidate(
        chunk_index=index,
        section=section_name,
        token_count=token_count,
        content=chunk,
        search_text="\n".join(part for part in [title, section_name, chunk] if part),
        content_hash=hashlib.sha256(
          f"{source_key}:{index}:{section_name or ''}:{chunk}".encode("utf-8")
        ).hexdigest(),
      )
      for index, (section_name, chunk, token_count) in enumerate(chunks)
    ]

  def _load_existing_chunks(
    self,
    db: Session,
    document_id: int,
  ) -> tuple[dict[int, models.EvidenceChunk], list[models.EvidenceChunk]]:
    existing_by_index: dict[int, models.EvidenceChunk] = {}
    duplicate_chunks: list[models.EvidenceChunk] = []

    existing_chunks = (
      db.query(models.EvidenceChunk)
      .filter(models.EvidenceChunk.document_id == document_id)
      .order_by(models.EvidenceChunk.chunk_index.asc(), models.EvidenceChunk.id.asc())
      .all()
    )
    for chunk in existing_chunks:
      if chunk.chunk_index in existing_by_index:
        duplicate_chunks.append(chunk)
      else:
        existing_by_index[chunk.chunk_index] = chunk

    return existing_by_index, duplicate_chunks

  def _upsert_document(self, db: Session, path: Path, parsed: ParsedDocument) -> models.EvidenceDocument:
    source_key = str(path.resolve())
    document = (
      db.query(models.EvidenceDocument)
      .filter(models.EvidenceDocument.source_key == source_key)
      .one_or_none()
    )
    metadata = {"section": parsed.section, "path": source_key}
    if document is None:
      document = models.EvidenceDocument(
        source_key=source_key,
        title=parsed.title,
        source=parsed.source,
        url=parsed.url,
        document_metadata=metadata,
      )
      db.add(document)
      db.flush()
      return document

    document.title = parsed.title
    document.source = parsed.source
    document.url = parsed.url
    document.document_metadata = {**(document.document_metadata or {}), **metadata}
    db.flush()
    return document

  def ingest_document(
    self,
    db: Session,
    path: Path,
    *,
    allow_heuristic_fallback: bool = False,
    throttle_seconds: float | None = None,
    batch_size: int | None = None,
  ) -> DocumentIngestionResult:
    parsed = self.parse_document(path)
    document = self._upsert_document(db, path, parsed)
    source_key = str(path.resolve())
    result = DocumentIngestionResult(
      path=path,
      document_id=document.id,
      title=document.title,
    )

    chunk_candidates = self._build_chunk_candidates(
      source_key,
      title=parsed.title,
      chunks=self._chunk_text(parsed.content, default_section=parsed.section),
    )
    result.total_chunks = len(chunk_candidates)

    existing_by_index, duplicate_chunks = self._load_existing_chunks(db, document.id)
    pending: list[tuple[ChunkCandidate, models.EvidenceChunk | None]] = []
    for candidate in chunk_candidates:
      existing = existing_by_index.get(candidate.chunk_index)
      if existing and existing.content_hash == candidate.content_hash:
        existing.section = candidate.section
        existing.page = parsed.page
        existing.search_text = candidate.search_text
        existing.chunk_metadata = {
          **(existing.chunk_metadata or {}),
          "embedding_mode": (existing.chunk_metadata or {}).get("embedding_mode", "unknown"),
          "source_key": source_key,
          "token_count": candidate.token_count,
        }
        result.reused_chunks += 1
        continue
      pending.append((candidate, existing))

    if pending:
      embedding_result = self.ai.embed_detailed(
        [candidate.content for candidate, _ in pending],
        allow_heuristic_fallback=allow_heuristic_fallback,
        throttle_seconds=throttle_seconds,
        batch_size=batch_size,
      )
      for (candidate, existing), embedded_item in zip(pending, embedding_result.items):
        if not embedded_item.success or embedded_item.embedding is None:
          result.failed_chunks += 1
          error_message = (
            f"chunk_index={candidate.chunk_index} attempts={embedded_item.attempts} "
            f"error={embedded_item.error or 'Embedding request failed'}"
          )
          result.errors.append(error_message)
          logger.warning(
            "Evidence chunk embedding failed path=%s chunk_index=%s attempts=%s error=%s",
            path,
            candidate.chunk_index,
            embedded_item.attempts,
            embedded_item.error or "Embedding request failed",
          )
          continue

        chunk_metadata = {
          **((existing.chunk_metadata if existing else {}) or {}),
          "embedding_mode": embedded_item.mode,
          "embedding_attempts": embedded_item.attempts,
          "source_key": source_key,
          "token_count": candidate.token_count,
        }
        chunk_metadata.pop("embedding_error", None)

        if existing is None:
          db.add(
            models.EvidenceChunk(
              document_id=document.id,
              chunk_index=candidate.chunk_index,
              section=candidate.section,
              page=parsed.page,
              content=candidate.content,
              search_text=candidate.search_text,
              content_hash=candidate.content_hash,
              embedding=embedded_item.embedding,
              chunk_metadata=chunk_metadata,
            )
          )
        else:
          existing.section = candidate.section
          existing.page = parsed.page
          existing.content = candidate.content
          existing.search_text = candidate.search_text
          existing.content_hash = candidate.content_hash
          existing.embedding = embedded_item.embedding
          existing.chunk_metadata = chunk_metadata

        if embedded_item.mode == "heuristic":
          result.heuristic_chunks += 1
        else:
          result.openai_chunks += 1

    current_indices = {candidate.chunk_index for candidate in chunk_candidates}
    stale_chunks = [
      chunk
      for chunk_index, chunk in existing_by_index.items()
      if chunk_index not in current_indices
    ]
    cleanup_candidates = stale_chunks + duplicate_chunks
    if result.failed_chunks == 0:
      for chunk in cleanup_candidates:
        db.delete(chunk)
      result.deleted_chunks = len(cleanup_candidates)
    else:
      result.deferred_cleanup_chunks = len(cleanup_candidates)
      if cleanup_candidates:
        logger.warning(
          "Skipping stale evidence chunk cleanup due to partial ingestion path=%s deferred_cleanup_chunks=%s",
          path,
          len(cleanup_candidates),
        )

    document.document_metadata = {
      **(document.document_metadata or {}),
      "section": parsed.section,
      "path": source_key,
      "chunk_count": result.total_chunks,
      "chunk_size_tokens": settings.evidence_chunk_size_tokens,
      "chunk_overlap_tokens": settings.evidence_chunk_overlap_tokens,
      "last_ingested_at": datetime.now(timezone.utc).isoformat(),
      "last_ingest_status": result.status,
      "last_ingest_reused_chunks": result.reused_chunks,
      "last_ingest_openai_chunks": result.openai_chunks,
      "last_ingest_heuristic_chunks": result.heuristic_chunks,
      "last_ingest_failed_chunks": result.failed_chunks,
      "last_ingest_deleted_chunks": result.deleted_chunks,
      "last_ingest_deferred_cleanup_chunks": result.deferred_cleanup_chunks,
      "last_ingest_errors": result.errors[:20],
    }
    db.flush()
    return result

  def ingest_directory(
    self,
    db: Session,
    directory: Path,
    *,
    allow_heuristic_fallback: bool = False,
    throttle_seconds: float | None = None,
    batch_size: int | None = None,
  ) -> IngestionSummary:
    summary = IngestionSummary()
    for path in sorted(directory.glob("**/*")):
      if not path.is_file() or path.suffix.lower() not in {".md", ".txt"}:
        continue

      try:
        result = self.ingest_document(
          db,
          path,
          allow_heuristic_fallback=allow_heuristic_fallback,
          throttle_seconds=throttle_seconds,
          batch_size=batch_size,
        )
        db.commit()
      except Exception as exc:
        db.rollback()
        logger.exception("Evidence document ingestion failed path=%s", path)
        result = DocumentIngestionResult(
          path=path,
          fatal_error=str(exc),
          errors=[str(exc)],
        )

      summary.documents.append(result)
      log_method = logger.info if result.status == "success" else logger.warning
      log_method(
        (
          "Evidence document ingested path=%s status=%s total_chunks=%s reused_chunks=%s "
          "openai_chunks=%s heuristic_chunks=%s failed_chunks=%s deleted_chunks=%s"
        ),
        path,
        result.status,
        result.total_chunks,
        result.reused_chunks,
        result.openai_chunks,
        result.heuristic_chunks,
        result.failed_chunks,
        result.deleted_chunks,
      )

    return summary

  def search(
    self,
    db: Session,
    query: str,
    top_k: int = 5,
    *,
    dedupe_by_document: bool = True,
    filters: RetrievalFilters | dict[str, Any] | None = None,
  ) -> EvidenceSearchOutcome:
    started_at = time.perf_counter()
    profile = self._build_query_profile(query)
    normalized_filters = self._coerce_filters(filters)
    if not profile.normalized_query:
      return EvidenceSearchOutcome(
        results=[],
        mode="error",
        ai_mode=None,
        latency_ms=0,
        error_message="Enter a clinical topic or symptom phrase to search the evidence index.",
        fallback_reason=None,
        trace=None,
      )

    lexical_candidates, lexical_strategy = self._build_lexical_candidates(
      db,
      profile=profile,
      started_at=started_at,
      filters=normalized_filters,
    )
    error_message: str | None = None

    if self._remaining_timeout_ms(started_at) < 250:
      lexical_results = self._finalize_candidates(
        list(lexical_candidates.values()),
        profile=profile,
        top_k=top_k,
        dedupe_by_document=dedupe_by_document,
      )
      latency_ms = int((time.perf_counter() - started_at) * 1000)
      fallback_reason = "lexical_search_fallback" if lexical_results else "search_error"
      return EvidenceSearchOutcome(
        results=lexical_results,
        mode="fallback" if lexical_results else "error",
        ai_mode="search_fallback" if lexical_results else None,
        latency_ms=latency_ms,
        error_message=(
          "Evidence search timed out before vector ranking completed. "
          + ("Showing lexical evidence matches." if lexical_results else "Try the search again.")
        ),
        normalized_query=profile.normalized_query,
        fallback_reason=fallback_reason,
        trace=self._build_trace(
          profile=profile,
          mode="fallback" if lexical_results else "error",
          ai_mode="search_fallback" if lexical_results else None,
          fallback_reason=fallback_reason,
          lexical_strategy=lexical_strategy,
          filters=normalized_filters,
          selected_results=lexical_results,
        ),
      )

    try:
      embedding_result = self.ai.embed_detailed(
        [profile.normalized_query],
        allow_heuristic_fallback=False,
        throttle_seconds=0.0,
        batch_size=1,
        max_retries=settings.evidence_query_embedding_max_retries,
        request_timeout_seconds=max(1.0, min(settings.evidence_search_timeout_seconds / 2, 4.0)),
      )
      embedded_query = embedding_result.items[0]
      if not embedded_query.success or embedded_query.embedding is None:
        raise RuntimeError(embedded_query.error or "Embedding request failed")

      vector_rows = self._run_vector_query(
        db,
        embedding=embedded_query.embedding,
        started_at=started_at,
        filters=normalized_filters,
      )
      merged_candidates = dict(lexical_candidates)
      for row in vector_rows:
        candidate_id = str(row["id"])
        candidate = merged_candidates.get(candidate_id)
        if candidate is None:
          candidate = RankedEvidenceCandidate(
            id=candidate_id,
            document_id=int(row["document_id"]),
            title=str(row["title"] or "Untitled evidence"),
            text=str(row["content"] or ""),
            source=row.get("source"),
            url=row.get("url"),
            section=row.get("section"),
            page=row.get("page"),
            lexical_score=self._score_text_match(
              profile,
              title=str(row["title"] or ""),
              section=row.get("section"),
              content=str(row["content"] or ""),
            ),
          )
        candidate.vector_score = self._normalize_vector_score(row.get("score"))
        merged_candidates[candidate_id] = candidate

      results = self._finalize_candidates(
        list(merged_candidates.values()),
        profile=profile,
        top_k=top_k,
        dedupe_by_document=dedupe_by_document,
      )
      latency_ms = int((time.perf_counter() - started_at) * 1000)
      trace = self._build_trace(
        profile=profile,
        mode="real",
        ai_mode="openai",
        fallback_reason=None,
        lexical_strategy=lexical_strategy,
        filters=normalized_filters,
        selected_results=results,
      )
      logger.info(
        (
          "Evidence vector search completed query=%s normalized_query=%s result_count=%s "
          "mode=real ai_mode=openai fallback_reason=%s latency_ms=%s"
        ),
        query,
        profile.normalized_query,
        len(results),
        None,
        latency_ms,
      )
      if not results:
        error_message = "No evidence matches were found in the local index for this topic."
      return EvidenceSearchOutcome(
        results=results,
        mode="real",
        ai_mode="openai",
        latency_ms=latency_ms,
        error_message=error_message,
        normalized_query=profile.normalized_query,
        fallback_reason=None,
        trace=trace,
      )
    except TimeoutError as exc:
      error_message = str(exc)
    except Exception as exc:
      error_message = (
        "Vector search is unavailable or rate-limited. Showing lexical evidence matches from the local index."
      )
      logger.warning(
        (
          "Evidence vector search fallback query=%s normalized_query=%s error=%s "
          "fallback_reason=%s remaining_timeout_ms=%s"
        ),
        query,
        profile.normalized_query,
        exc.__class__.__name__,
        "lexical_search_fallback",
        self._remaining_timeout_ms(started_at),
      )

    fallback_results = self._finalize_candidates(
      list(lexical_candidates.values()),
      profile=profile,
      top_k=top_k,
      dedupe_by_document=dedupe_by_document,
    )
    latency_ms = int((time.perf_counter() - started_at) * 1000)
    mode = "fallback" if fallback_results else "error"
    if not fallback_results and error_message is None:
      error_message = "No evidence matches were found in the local index for this topic."
    fallback_reason = "lexical_search_fallback" if fallback_results else "search_error"
    logger.info(
      (
        "Evidence lexical search completed query=%s normalized_query=%s result_count=%s "
        "mode=%s ai_mode=%s fallback_reason=%s latency_ms=%s"
      ),
      query,
      profile.normalized_query,
      len(fallback_results),
      mode,
      "search_fallback" if fallback_results else None,
      fallback_reason,
      latency_ms,
    )
    return EvidenceSearchOutcome(
      results=fallback_results,
      mode=mode,
      ai_mode="search_fallback" if fallback_results else None,
      latency_ms=latency_ms,
      error_message=error_message,
      normalized_query=profile.normalized_query,
      fallback_reason=fallback_reason,
      trace=self._build_trace(
        profile=profile,
        mode=mode,
        ai_mode="search_fallback" if fallback_results else None,
        fallback_reason=fallback_reason,
        lexical_strategy=lexical_strategy,
        filters=normalized_filters,
        selected_results=fallback_results,
      ),
    )


_vector_service: VectorService | None = None


def get_vector_service() -> VectorService:
  global _vector_service
  if _vector_service is None:
    _vector_service = VectorService()
  return _vector_service
