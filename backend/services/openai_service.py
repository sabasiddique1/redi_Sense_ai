from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import hashlib
import json
import logging
import math
import random
import re
import time
from typing import Any, TypeVar

from openai import (
  APIConnectionError,
  APITimeoutError,
  InternalServerError,
  OpenAI,
  RateLimitError,
)
from pydantic import BaseModel, Field, ValidationError

from backend.config import get_settings
from backend.services.rag_prompts import PromptEvidenceItem, build_copilot_rag_prompts


logger = logging.getLogger(__name__)
settings = get_settings()
_client: OpenAI | None = None

T = TypeVar("T", bound=BaseModel)
_REPORT_KEYWORD_STOPWORDS = {
  "about",
  "after",
  "assessment",
  "clinical",
  "contrast",
  "exam",
  "findings",
  "history",
  "impression",
  "indication",
  "patient",
  "report",
  "review",
  "section",
  "study",
  "with",
  "without",
}
_REPORT_SECTION_LABELS = (
  "findings",
  "impression",
  "assessment",
  "recommendation",
  "recommendations",
  "conclusion",
)
_TRANSIENT_CHAT_EXCEPTIONS = (
  RateLimitError,
  APIConnectionError,
  APITimeoutError,
  InternalServerError,
)


class ReportAnalysisPayload(BaseModel):
  predicted_category: str = Field(min_length=1)
  plain_language_summary: str = Field(min_length=1)
  top_keywords: list[str] = Field(default_factory=list)
  extracted_findings: list[str] = Field(default_factory=list)
  follow_up_recommendations: list[str] = Field(default_factory=list)
  safety_flags: list[str] = Field(default_factory=list)
  structured_data: dict[str, Any] = Field(default_factory=dict)


class TriagePayload(BaseModel):
  risk_level: str
  red_flags: list[str] = Field(default_factory=list)
  recommended_action: str
  summary: str
  differential: list[str] = Field(default_factory=list)


class CopilotPayload(BaseModel):
  reply: str
  citation_ids: list[str] = Field(default_factory=list)
  insufficient_evidence: bool = False


@dataclass
class StructuredChatError(RuntimeError):
  feature: str
  fallback_reason: str
  error_type: str
  last_error: Exception | None = None

  def __str__(self) -> str:  # pragma: no cover - trivial
    return (
      f"StructuredChatError(feature={self.feature}, fallback_reason={self.fallback_reason}, "
      f"error_type={self.error_type})"
    )


@dataclass
class EmbeddingItemResult:
  text: str
  embedding: list[float] | None
  mode: str
  success: bool
  attempts: int
  error: str | None = None


@dataclass
class EmbeddingBatchResult:
  items: list[EmbeddingItemResult]

  @property
  def total(self) -> int:
    return len(self.items)

  @property
  def successful(self) -> int:
    return sum(1 for item in self.items if item.success)

  @property
  def failed(self) -> int:
    return self.total - self.successful

  @property
  def mode(self) -> str:
    if not self.items:
      return "openai"
    modes = {item.mode for item in self.items if item.success}
    if not modes:
      return "failed"
    if len(modes) == 1:
      return modes.pop()
    return "mixed"

  def require_embeddings(self) -> tuple[list[list[float]], str]:
    if self.failed:
      raise RuntimeError("Embedding batch contains failed items.")
    embeddings = [item.embedding for item in self.items if item.embedding is not None]
    return embeddings, self.mode


def get_client() -> OpenAI | None:
  global _client
  if not settings.openai_api_key:
    return None
  if _client is None:
    _client = OpenAI(api_key=settings.openai_api_key, timeout=settings.request_timeout_seconds)
  return _client


def _classify_chat_failure(error: Exception) -> str:
  if isinstance(error, APITimeoutError):
    return "openai_timeout"
  if isinstance(error, RateLimitError):
    return "openai_rate_limit"
  if isinstance(error, (APIConnectionError, InternalServerError)):
    return "provider_unavailable"
  if isinstance(error, json.JSONDecodeError):
    return "json_parse_failed"
  if isinstance(error, ValidationError):
    return "openai_bad_response"
  if isinstance(error, ValueError):
    return "json_parse_failed"
  return "unknown_error"


def _chat_retry_delay_seconds(attempt: int) -> float:
  return min(0.35 * attempt, 1.0)


def _log_ai_failure(
  *,
  feature: str,
  provider: str,
  model: str,
  error: Exception,
  fallback_reason: str,
  fallback_used: bool,
  attempt: int | None = None,
  will_retry: bool = False,
) -> None:
  logger.warning(
    (
      "AI failure feature=%s provider=%s model=%s error_type=%s fallback_reason=%s "
      "fallback_used=%s attempt=%s will_retry=%s"
    ),
    feature,
    provider,
    model,
    error.__class__.__name__,
    fallback_reason,
    fallback_used,
    attempt,
    will_retry,
  )


def _extract_json(content: str) -> dict[str, Any]:
  try:
    return json.loads(content)
  except json.JSONDecodeError:
    start = content.find("{")
    end = content.rfind("}")
    if start >= 0 and end > start:
      return json.loads(content[start : end + 1])
    raise


def _run_structured_chat(
  *,
  feature: str,
  system_prompt: str,
  user_content: str,
  schema: type[T],
) -> tuple[T, str]:
  client = get_client()
  if client is None:
    raise StructuredChatError(
      feature=feature,
      fallback_reason="openai_api_key_missing",
      error_type="MissingApiKey",
    )

  last_error: Exception | None = None
  max_attempts = 3
  for attempt in range(1, max_attempts + 1):
    try:
      response = client.chat.completions.create(
        model=settings.openai_chat_model,
        response_format={"type": "json_object"},
        temperature=0.1,
        messages=[
          {"role": "system", "content": system_prompt},
          {
            "role": "user",
            "content": (
              user_content
              + "\n\nReturn only JSON that conforms to the requested schema."
            ),
          },
        ],
      )
      content = response.choices[0].message.content or "{}"
      payload = schema.model_validate(_extract_json(content))
      return payload, "openai"
    except (ValidationError, ValueError, json.JSONDecodeError) as exc:
      last_error = exc
      fallback_reason = _classify_chat_failure(exc)
      will_retry = attempt < max_attempts
      _log_ai_failure(
        feature=feature,
        provider="openai",
        model=settings.openai_chat_model,
        error=exc,
        fallback_reason=fallback_reason,
        fallback_used=not will_retry,
        attempt=attempt,
        will_retry=will_retry,
      )
      if will_retry:
        time.sleep(_chat_retry_delay_seconds(attempt))
        continue
      raise StructuredChatError(
        feature=feature,
        fallback_reason=fallback_reason,
        error_type=exc.__class__.__name__,
        last_error=exc,
      ) from exc
    except _TRANSIENT_CHAT_EXCEPTIONS as exc:
      last_error = exc
      fallback_reason = _classify_chat_failure(exc)
      will_retry = attempt < max_attempts
      _log_ai_failure(
        feature=feature,
        provider="openai",
        model=settings.openai_chat_model,
        error=exc,
        fallback_reason=fallback_reason,
        fallback_used=not will_retry,
        attempt=attempt,
        will_retry=will_retry,
      )
      if will_retry:
        time.sleep(_chat_retry_delay_seconds(attempt))
        continue
      raise StructuredChatError(
        feature=feature,
        fallback_reason=fallback_reason,
        error_type=exc.__class__.__name__,
        last_error=exc,
      ) from exc
    except Exception as exc:  # pragma: no cover - provider failures
      last_error = exc
      fallback_reason = _classify_chat_failure(exc)
      _log_ai_failure(
        feature=feature,
        provider="openai",
        model=settings.openai_chat_model,
        error=exc,
        fallback_reason=fallback_reason,
        fallback_used=True,
        attempt=attempt,
        will_retry=False,
      )
      raise StructuredChatError(
        feature=feature,
        fallback_reason=fallback_reason,
        error_type=exc.__class__.__name__,
        last_error=exc,
      ) from exc

  raise StructuredChatError(
    feature=feature,
    fallback_reason=_classify_chat_failure(last_error or RuntimeError("Structured output unavailable")),
    error_type=(last_error.__class__.__name__ if last_error else "StructuredOutputUnavailable"),
    last_error=last_error,
  )


def _tokenize(text: str) -> list[str]:
  return re.findall(r"[A-Za-z0-9][A-Za-z0-9-]{1,}", text.lower())


def _first_non_empty_line(text: str) -> str | None:
  for line in text.splitlines():
    cleaned = line.strip()
    if cleaned:
      return cleaned
  return None


def _extract_section(text: str, labels: tuple[str, ...]) -> str | None:
  lowered = text.lower()
  for label in labels:
    marker = f"{label.lower()}:"
    idx = lowered.find(marker)
    if idx >= 0:
      section = text[idx + len(marker) :]
      return section.split("\n\n", 1)[0].strip()
  return None


def _detect_modality(text: str) -> str | None:
  lowered = text.lower()
  for modality in ("ct", "mri", "x-ray", "cxr", "ultrasound", "echo", "pet-ct", "pathology"):
    if modality in lowered:
      return modality.upper()
  return None


def _detect_body_part(text: str) -> str | None:
  lowered = text.lower()
  for part in ("chest", "abdomen", "pelvis", "brain", "head", "lung", "cardiac", "spine"):
    if part in lowered:
      return part.title()
  return None


def _normalize_text_list(values: Any, *, limit: int = 6) -> list[str]:
  if not isinstance(values, list):
    return []

  normalized: list[str] = []
  for value in values:
    if not isinstance(value, str):
      continue
    cleaned = re.sub(r"\s+", " ", value).strip(" -\t")
    if cleaned:
      normalized.append(cleaned[:240])

  return list(dict.fromkeys(normalized))[:limit]


def _split_sentences(text: str, *, limit: int = 6) -> list[str]:
  parts = re.split(r"(?<=[.!?])\s+|\n+", text)
  cleaned = [
    re.sub(r"\s+", " ", part).strip(" -\t")
    for part in parts
    if part and re.sub(r"\s+", " ", part).strip(" -\t")
  ]
  return list(dict.fromkeys(cleaned))[:limit]


def _extract_report_sections(text: str) -> dict[str, str]:
  pattern = re.compile(
    r"(?im)^(findings|impression|assessment|recommendations?|conclusion)\s*:\s*"
  )
  matches = list(pattern.finditer(text))
  if not matches:
    return {}

  sections: dict[str, str] = {}
  for index, match in enumerate(matches):
    label = match.group(1).lower()
    start = match.end()
    end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
    content = re.sub(r"\s+\n", "\n", text[start:end]).strip()
    if content:
      sections[label] = content
  return sections


def _extract_source_grounded_findings(text: str, sections: dict[str, str]) -> list[str]:
  findings: list[str] = []
  for label in ("findings", "impression", "assessment", "conclusion"):
    section = sections.get(label)
    if section:
      findings.extend(_split_sentences(section, limit=8))

  if not findings:
    for line in text.splitlines():
      cleaned = re.sub(r"\s+", " ", line).strip(" -\t")
      if len(cleaned) >= 20:
        findings.append(cleaned)
      if len(findings) >= 5:
        break

  return list(dict.fromkeys(findings))[:5]


def _extract_follow_up_recommendations(text: str, sections: dict[str, str]) -> list[str]:
  recommendations: list[str] = []
  recommendation_terms = ("recommend", "follow-up", "follow up", "repeat", "consult", "referral", "biopsy", "pet-ct")

  for label in ("recommendation", "recommendations", "impression", "assessment", "conclusion", "findings"):
    section = sections.get(label)
    if not section:
      continue
    for sentence in _split_sentences(section, limit=10):
      lowered = sentence.lower()
      if any(term in lowered for term in recommendation_terms):
        recommendations.append(sentence)

  if not recommendations:
    for sentence in _split_sentences(text, limit=12):
      lowered = sentence.lower()
      if any(term in lowered for term in recommendation_terms):
        recommendations.append(sentence)

  return list(dict.fromkeys(recommendations))[:4]


def _extract_report_keywords(
  category: str,
  findings: list[str],
  recommendations: list[str],
) -> list[str]:
  counts: dict[str, int] = {}
  for token in _tokenize(" ".join([category, *findings, *recommendations])):
    if len(token) < 4 or token in _REPORT_KEYWORD_STOPWORDS:
      continue
    counts[token] = counts.get(token, 0) + 1

  ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
  return [token for token, _count in ranked[:6]]


def _normalize_report_match_text(text: str) -> str:
  normalized = re.sub(r"[^a-z0-9\s-]+", " ", text.lower())
  return re.sub(r"\s+", " ", normalized).strip()


def _is_source_grounded_finding(source_text: str, finding: str) -> bool:
  normalized_source = _normalize_report_match_text(source_text)
  normalized_finding = _normalize_report_match_text(finding)
  if not normalized_source or not normalized_finding:
    return False

  if normalized_finding in normalized_source:
    return True

  source_tokens = set(
    token
    for token in _tokenize(normalized_source)
    if len(token) > 2 and token not in _REPORT_KEYWORD_STOPWORDS
  )
  finding_tokens = [
    token
    for token in _tokenize(normalized_finding)
    if len(token) > 2 and token not in _REPORT_KEYWORD_STOPWORDS
  ]
  if not finding_tokens:
    return False
  matched = sum(1 for token in finding_tokens if token in source_tokens)
  coverage = matched / len(finding_tokens)
  return coverage >= (1.0 if len(finding_tokens) <= 3 else 0.75)


def _summary_is_unsafe(summary: str, source_text: str) -> bool:
  lowered_summary = summary.lower()
  lowered_source = source_text.lower()
  unsafe_phrases = (
    "this means cancer",
    "definitely malignant",
    "definite cancer",
    "confirms cancer",
  )
  if any(phrase in lowered_summary for phrase in unsafe_phrases):
    return True
  if "sign of cancer" in lowered_summary and "cancer" not in lowered_source and "malign" not in lowered_source:
    return True
  if "metast" in lowered_summary and "metast" not in lowered_source:
    return True
  if "lymph node" in lowered_summary and "lymph node" not in lowered_source:
    return True
  return False


def _sanitize_patient_summary(summary: str) -> str:
  cleaned = re.sub(r"\s+", " ", summary).strip()
  replacements = {
    "this means cancer": "this can be associated with malignancy and needs further evaluation",
    "sign of cancer": "can be associated with malignancy",
    "definitely malignant": "concerning for malignancy",
    "definite cancer": "concerning for malignancy",
    "confirms cancer": "raises concern for malignancy",
  }
  lowered = cleaned.lower()
  for phrase, replacement in replacements.items():
    if phrase in lowered:
      cleaned = re.sub(phrase, replacement, cleaned, flags=re.IGNORECASE)
      lowered = cleaned.lower()
  return cleaned


def _build_safe_report_summary(
  findings: list[str],
  recommendations: list[str],
  *,
  ai_unavailable: bool,
) -> str:
  parts = [
    "AI interpretation unavailable. Showing extracted report content."
    if ai_unavailable
    else "The report describes the source-grounded findings listed below."
  ]
  if findings:
    parts.append(f"One stated finding is: {findings[0]}")
  if recommendations:
    parts.append("The report also includes follow-up recommendations.")
  return " ".join(parts)


def _derive_report_safety_flags(
  source_text: str,
  recommendations: list[str],
  *,
  ai_unavailable: bool,
) -> list[str]:
  lowered = source_text.lower()
  flags: list[str] = []
  if recommendations:
    flags.append("follow_up_recommended")
  if any(term in lowered for term in ("suspicious", "spiculation", "concerning for malign", "malignancy")):
    flags.append("suspicious_language_present")
  if any(term in lowered for term in ("critical result", "urgent", "immediate", "emergent")):
    flags.append("urgent_review_language_present")
  if ai_unavailable:
    flags.append("ai_interpretation_unavailable")
  return list(dict.fromkeys(flags))[:5]


def normalize_report_analysis_result(
  result: dict[str, Any],
  source_text: str,
) -> dict[str, Any]:
  sections = _extract_report_sections(source_text)
  structured_data = result.get("structured_data")
  if not isinstance(structured_data, dict):
    structured_data = {}

  predicted_category = re.sub(
    r"\s+",
    " ",
    str(result.get("predicted_category") or result.get("classification") or "").strip(),
  ) or (_detect_body_part(source_text) and f"{_detect_modality(source_text) or 'Clinical'} {_detect_body_part(source_text)}") or _detect_modality(source_text) or "Clinical report"

  model_findings = _normalize_text_list(
    result.get("extracted_findings") or result.get("key_findings"),
    limit=6,
  )
  grounded_findings = [
    finding
    for finding in model_findings
    if _is_source_grounded_finding(source_text, finding)
  ]
  if not grounded_findings:
    grounded_findings = _extract_source_grounded_findings(source_text, sections)

  recommendation_values = result.get("follow_up_recommendations")
  if recommendation_values is None:
    recommendation_text = structured_data.get("recommendation")
    if isinstance(recommendation_text, str) and recommendation_text.strip():
      recommendation_values = [
        segment.strip()
        for segment in re.split(r",|;", recommendation_text)
        if segment.strip()
      ]
  follow_up_recommendations = _normalize_text_list(recommendation_values, limit=4)
  if not follow_up_recommendations:
    follow_up_recommendations = _extract_follow_up_recommendations(source_text, sections)

  top_keywords = _normalize_text_list(result.get("top_keywords"), limit=6)
  if not top_keywords:
    top_keywords = _extract_report_keywords(
      predicted_category,
      grounded_findings,
      follow_up_recommendations,
    )

  plain_language_summary = str(
    result.get("plain_language_summary") or result.get("summary") or ""
  ).strip()
  plain_language_summary = _sanitize_patient_summary(plain_language_summary) if plain_language_summary else ""
  ai_unavailable = result.get("mode") != "openai"
  if ai_unavailable:
    plain_language_summary = _build_safe_report_summary(
      grounded_findings,
      follow_up_recommendations,
      ai_unavailable=True,
    )
  elif not plain_language_summary or _summary_is_unsafe(plain_language_summary, source_text):
    plain_language_summary = _build_safe_report_summary(
      grounded_findings,
      follow_up_recommendations,
      ai_unavailable=False,
    )

  safety_flags = _normalize_text_list(result.get("safety_flags"), limit=5)
  derived_flags = _derive_report_safety_flags(
    source_text,
    follow_up_recommendations,
    ai_unavailable=ai_unavailable,
  )
  safety_flags = list(dict.fromkeys([*safety_flags, *derived_flags]))[:6]

  modality = structured_data.get("modality") if isinstance(structured_data.get("modality"), str) else _detect_modality(source_text)
  body_part = structured_data.get("body_part") if isinstance(structured_data.get("body_part"), str) else _detect_body_part(source_text)
  enriched_structured_data = {
    **structured_data,
    **({"modality": modality} if modality else {}),
    **({"body_part": body_part} if body_part else {}),
    **({"source_sections": sections} if sections else {}),
    **({"follow_up_recommendations": follow_up_recommendations} if follow_up_recommendations else {}),
    **({"safety_flags": safety_flags} if safety_flags else {}),
  }

  return {
    "classification": predicted_category,
    "key_findings": grounded_findings,
    "summary": plain_language_summary,
    "predicted_category": predicted_category,
    "plain_language_summary": plain_language_summary,
    "top_keywords": top_keywords,
    "extracted_findings": grounded_findings,
    "follow_up_recommendations": follow_up_recommendations,
    "safety_flags": safety_flags,
    "structured_data": enriched_structured_data,
    "mode": str(result.get("mode") or "heuristic"),
    "fallback_reason": result.get("fallback_reason"),
  }


def _report_fallback(text: str, *, fallback_reason: str) -> dict[str, Any]:
  sections = _extract_report_sections(text)
  findings = _extract_source_grounded_findings(text, sections)
  recommendations = _extract_follow_up_recommendations(text, sections)
  category = (_detect_body_part(text) and f"{_detect_modality(text) or 'Clinical'} {_detect_body_part(text)}") or _detect_modality(text) or "Clinical report"
  summary = _build_safe_report_summary(findings, recommendations, ai_unavailable=True)

  return normalize_report_analysis_result(
    {
      "predicted_category": category,
      "plain_language_summary": summary,
      "top_keywords": _extract_report_keywords(category, findings, recommendations),
      "extracted_findings": findings,
      "follow_up_recommendations": recommendations,
      "safety_flags": ["ai_interpretation_unavailable"],
      "structured_data": {
        "modality": _detect_modality(text),
        "body_part": _detect_body_part(text),
        "source_sections": sections,
      },
      "mode": "extraction_only",
      "fallback_reason": fallback_reason,
    },
    text,
  )


def _triage_fallback(symptoms: str, *, fallback_reason: str) -> dict[str, Any]:
  lowered = symptoms.lower()
  risk_level = "Moderate"
  red_flags: list[str] = []
  differential: list[str] = []
  recommended_action = "Urgent clinician review recommended."
  summary = "Symptoms require clinical review to determine severity and next steps."

  if any(term in lowered for term in ("chest pain", "left arm", "diaphoresis", "shortness of breath")):
    risk_level = "Critical"
    red_flags.extend(
      [
        "Possible cardiac or cardiopulmonary emergency",
        "Immediate ECG and vital sign assessment indicated",
      ]
    )
    differential.extend(
      ["Acute coronary syndrome", "Pulmonary embolism", "Aortic syndrome"]
    )
    recommended_action = "Send to the emergency department for immediate evaluation."
    summary = "High-risk cardiopulmonary symptoms were detected and require emergency assessment."
  elif any(term in lowered for term in ("focal weakness", "facial droop", "slurred speech")):
    risk_level = "Critical"
    red_flags.append("Possible acute neurologic deficit")
    differential.extend(["Stroke", "Transient ischemic attack"])
    recommended_action = "Activate emergency stroke evaluation immediately."
    summary = "Neurologic red flags were detected and need time-sensitive escalation."
  elif any(term in lowered for term in ("fever", "tachycardia", "hypotension", "confusion")):
    risk_level = "High"
    red_flags.append("Possible systemic infection or sepsis physiology")
    differential.extend(["Sepsis", "Pneumonia", "Urinary infection"])
    recommended_action = "Arrange urgent in-person evaluation and monitor vitals."
    summary = "Symptoms include warning signs that warrant urgent escalation."
  else:
    differential.append("Further workup needed")

  return {
    "risk_level": risk_level,
    "red_flags": red_flags,
    "recommended_action": recommended_action,
    "summary": summary,
    "differential": differential,
    "mode": "heuristic",
    "fallback_reason": fallback_reason,
  }


def _copilot_fallback(message: str, context: str | None, *, fallback_reason: str) -> dict[str, Any]:
  reply = "ReportIQ can summarize findings, triage risk, and surface evidence, but it is not a diagnosis engine."
  if context:
    reply += f" Patient context was provided. Use it to confirm the active concern in the chart before acting.\n\nQuestion: {message}"
  else:
    reply += f" Add patient context when available, then use report analysis, triage, or evidence search as appropriate.\n\nQuestion: {message}"

  return {
    "reply": reply,
    "citation_ids": [],
    "insufficient_evidence": True,
    "mode": "heuristic",
    "fallback_reason": fallback_reason,
  }


def _hash_embedding(text: str) -> list[float]:
  dimensions = settings.vector_dimensions
  vector = [0.0] * dimensions
  tokens = _tokenize(text)
  if not tokens:
    return vector

  for token in tokens:
    digest = hashlib.sha256(token.encode("utf-8")).digest()
    index = int.from_bytes(digest[:4], "big") % dimensions
    sign = 1.0 if digest[4] % 2 == 0 else -1.0
    vector[index] += sign * (1.0 + min(len(token), 12) / 12.0)

  norm = math.sqrt(sum(value * value for value in vector)) or 1.0
  return [value / norm for value in vector]


def _coerce_embedding_dimensions(embedding: list[float]) -> list[float]:
  dimensions = settings.vector_dimensions
  if len(embedding) == dimensions:
    return embedding
  if len(embedding) > dimensions:
    return embedding[:dimensions]
  return embedding + [0.0] * (dimensions - len(embedding))


def _retry_delay_seconds(attempt: int) -> float:
  base_delay = min(
    settings.embedding_initial_backoff_seconds * (2 ** max(attempt - 1, 0)),
    settings.embedding_max_backoff_seconds,
  )
  jitter = random.uniform(0.0, max(base_delay * 0.2, 0.1))
  return base_delay + jitter


def _embed_with_openai(
  texts: list[str],
  *,
  request_timeout_seconds: float | None = None,
) -> list[list[float]]:
  client = get_client()
  if client is None:
    raise RuntimeError("OpenAI client unavailable")

  if request_timeout_seconds is not None:
    client = client.with_options(timeout=request_timeout_seconds)

  response = client.embeddings.create(
    model=settings.openai_embedding_model,
    input=texts,
  )
  return [_coerce_embedding_dimensions(item.embedding) for item in response.data]


def embed_texts_detailed(
  texts: list[str],
  *,
  allow_heuristic_fallback: bool = True,
  throttle_seconds: float | None = None,
  batch_size: int | None = None,
  max_retries: int | None = None,
  request_timeout_seconds: float | None = None,
) -> EmbeddingBatchResult:
  if not texts:
    return EmbeddingBatchResult(items=[])

  if get_client() is None:
    return EmbeddingBatchResult(
      items=[
        EmbeddingItemResult(
          text=text,
          embedding=_hash_embedding(text),
          mode="heuristic",
          success=True,
          attempts=1,
        )
        for text in texts
      ]
    )

  effective_batch_size = max(batch_size or settings.embedding_batch_size, 1)
  effective_throttle = settings.embedding_throttle_seconds if throttle_seconds is None else max(throttle_seconds, 0.0)
  effective_max_retries = max_retries if max_retries is not None else settings.embedding_max_retries
  retryable_errors = (
    RateLimitError,
    APIConnectionError,
    APITimeoutError,
    InternalServerError,
  )

  items: list[EmbeddingItemResult] = []
  batches = [
    texts[index : index + effective_batch_size]
    for index in range(0, len(texts), effective_batch_size)
  ]

  for batch_index, batch in enumerate(batches):
    if batch_index > 0 and effective_throttle > 0:
      time.sleep(effective_throttle)

    last_error: Exception | None = None
    attempt_used = 0
    batch_succeeded = False
    for attempt in range(1, effective_max_retries + 2):
      attempt_used = attempt
      try:
        embeddings = _embed_with_openai(
          batch,
          request_timeout_seconds=request_timeout_seconds,
        )
        items.extend(
          EmbeddingItemResult(
            text=text,
            embedding=embedding,
            mode="openai",
            success=True,
            attempts=attempt,
          )
          for text, embedding in zip(batch, embeddings)
        )
        batch_succeeded = True
        break
      except retryable_errors as exc:  # pragma: no branch - retry loop
        last_error = exc
        if attempt > effective_max_retries:
          break

        delay = _retry_delay_seconds(attempt)
        logger.warning(
          "Embedding request failed attempt=%s/%s batch_size=%s error=%s retry_in_seconds=%.2f",
          attempt,
          effective_max_retries + 1,
          len(batch),
          exc.__class__.__name__,
          delay,
        )
        time.sleep(delay)
      except Exception as exc:  # pragma: no cover - provider failures
        last_error = exc
        logger.warning(
          "Embedding request failed without retry batch_size=%s error=%s",
          len(batch),
          exc.__class__.__name__,
        )
        break
    else:  # pragma: no cover - defensive
      last_error = RuntimeError("Embedding batch exhausted retries")

    if batch_succeeded:
      continue

    error_name = (last_error.__class__.__name__ if last_error else "EmbeddingError")
    error_message = str(last_error) if last_error else "Embedding request failed"
    if allow_heuristic_fallback:
      logger.warning(
        "Embedding batch falling back to heuristic mode batch_size=%s error=%s",
        len(batch),
        error_name,
      )
      items.extend(
        EmbeddingItemResult(
          text=text,
          embedding=_hash_embedding(text),
          mode="heuristic",
          success=True,
          attempts=attempt_used or 1,
          error=error_message,
        )
        for text in batch
      )
    else:
      logger.error(
        "Embedding batch failed after retries batch_size=%s error=%s",
        len(batch),
        error_name,
      )
      items.extend(
        EmbeddingItemResult(
          text=text,
          embedding=None,
          mode="failed",
          success=False,
          attempts=attempt_used or 1,
          error=error_message,
        )
        for text in batch
      )

  return EmbeddingBatchResult(items=items)


def generate_report_analysis(text: str) -> dict[str, Any]:
  system = (
    "You are an expert radiology and clinical report assistant. "
    "Return structured JSON for healthcare decision support. "
    "Separate source-grounded extraction from interpretation. "
    "Only include extracted findings that are explicitly stated in the source report. "
    "If a detail is not mentioned, omit it rather than inferring it. "
    "Do not invent lymph node status, metastases, additional nodules, stability, or diagnoses. "
    "Use cautious patient-facing wording. Prefer phrases like 'can be associated with' or "
    "'the report recommends follow-up' over definitive diagnostic claims."
  )
  user = (
    "Analyze the following report and return JSON with keys: "
    "predicted_category, plain_language_summary, top_keywords, extracted_findings, "
    "follow_up_recommendations, safety_flags, structured_data.\n"
    "Rules:\n"
    "- extracted_findings must be source-grounded and close to the original report wording.\n"
    "- plain_language_summary must stay cautious and non-diagnostic.\n"
    "- follow_up_recommendations must only include follow-up explicitly recommended in the report.\n"
    "- safety_flags should be concise machine-readable flags such as follow_up_recommended or suspicious_language_present.\n\n"
    f"Report:\n{text}"
  )
  try:
    payload, mode = _run_structured_chat(
      feature="report_analysis",
      system_prompt=system,
      user_content=user,
      schema=ReportAnalysisPayload,
    )
    return normalize_report_analysis_result(
      {
        **payload.model_dump(),
        "mode": mode,
        "fallback_reason": None,
      },
      text,
    )
  except StructuredChatError as exc:
    logger.warning(
      "AI fallback used feature=%s provider=openai model=%s fallback_reason=%s ai_mode=%s",
      exc.feature,
      settings.openai_chat_model,
      exc.fallback_reason,
      "extraction_only",
    )
    return _report_fallback(text, fallback_reason=exc.fallback_reason)
  except Exception as exc:  # pragma: no cover - defensive fallback
    _log_ai_failure(
      feature="report_analysis",
      provider="openai",
      model=settings.openai_chat_model,
      error=exc,
      fallback_reason="unknown_error",
      fallback_used=True,
    )
    return _report_fallback(text, fallback_reason="unknown_error")


def triage_symptoms(symptoms: str) -> dict[str, Any]:
  system = (
    "You are a clinical triage explanation assistant. "
    "The input is structured JSON that includes grounded triage facts and a grounded assessment. "
    "Do not diagnose. Do not invent symptoms, red flags, or risk factors. "
    "Do not change the grounded risk level, grounded red flags, or grounded recommendation. "
    "Use the grounded assessment as authoritative. "
    "Prefer common explanations over rare emergencies unless the grounded facts already justify emergency concern. "
    "Chronic symptoms and absence of red flags lower emergency concern. "
    "Return a conservative, structured triage summary."
  )
  user = (
    "Read the following JSON and return JSON with keys: "
    "risk_level, red_flags, recommended_action, summary, differential. "
    "Echo the grounded risk_level, grounded red_flags, and grounded recommended_action exactly as given. "
    "Use summary and differential only to explain the grounded result.\n\n"
    f"Triage JSON:\n{symptoms}"
  )
  try:
    payload, mode = _run_structured_chat(
      feature="triage_analysis",
      system_prompt=system,
      user_content=user,
      schema=TriagePayload,
    )
    data = payload.model_dump()
    risk = data["risk_level"].title()
    data["risk_level"] = risk if risk in {"Low", "Moderate", "High", "Critical"} else "Moderate"
    data["mode"] = mode
    data["fallback_reason"] = None
    return data
  except StructuredChatError as exc:
    logger.warning(
      "AI fallback used feature=%s provider=openai model=%s fallback_reason=%s ai_mode=%s",
      exc.feature,
      settings.openai_chat_model,
      exc.fallback_reason,
      "heuristic",
    )
    return _triage_fallback(symptoms, fallback_reason=exc.fallback_reason)
  except Exception as exc:  # pragma: no cover - defensive fallback
    _log_ai_failure(
      feature="triage_analysis",
      provider="openai",
      model=settings.openai_chat_model,
      error=exc,
      fallback_reason="unknown_error",
      fallback_used=True,
    )
    return _triage_fallback(symptoms, fallback_reason="unknown_error")


def generate_clinician_summary(text: str) -> dict[str, str]:
  summary = _extract_section(text, ("impression", "assessment")) or _first_non_empty_line(text) or text[:300]
  return {
    "patient_friendly": summary,
    "clinician_summary": summary,
  }


def chat_with_copilot(
  message: str,
  context: str | None = None,
  *,
  evidence_items: list[PromptEvidenceItem] | None = None,
) -> dict[str, Any]:
  # The copilot prompt is grounded with retrieved evidence ids so citations can be verified server-side.
  system, user = build_copilot_rag_prompts(
    question=message,
    patient_context=context,
    evidence_items=evidence_items or [],
  )
  try:
    payload, mode = _run_structured_chat(
      feature="copilot_chat",
      system_prompt=system,
      user_content=user,
      schema=CopilotPayload,
    )
    data = payload.model_dump()
    data["mode"] = mode
    data["fallback_reason"] = None
    return data
  except StructuredChatError as exc:
    logger.warning(
      "AI fallback used feature=%s provider=openai model=%s fallback_reason=%s ai_mode=%s",
      exc.feature,
      settings.openai_chat_model,
      exc.fallback_reason,
      "heuristic",
    )
    return _copilot_fallback(message, context, fallback_reason=exc.fallback_reason)
  except Exception as exc:  # pragma: no cover - defensive fallback
    _log_ai_failure(
      feature="copilot_chat",
      provider="openai",
      model=settings.openai_chat_model,
      error=exc,
      fallback_reason="unknown_error",
      fallback_used=True,
    )
    return _copilot_fallback(message, context, fallback_reason="unknown_error")


def embed_texts(
  texts: list[str],
  *,
  allow_heuristic_fallback: bool = True,
  throttle_seconds: float | None = None,
  batch_size: int | None = None,
  max_retries: int | None = None,
  request_timeout_seconds: float | None = None,
) -> tuple[list[list[float]], str]:
  return embed_texts_detailed(
    texts,
    allow_heuristic_fallback=allow_heuristic_fallback,
    throttle_seconds=throttle_seconds,
    batch_size=batch_size,
    max_retries=max_retries,
    request_timeout_seconds=request_timeout_seconds,
  ).require_embeddings()


class AIProvider:
  def analyze_report(self, text: str) -> dict[str, Any]:
    return generate_report_analysis(text)

  def triage(self, symptoms: str) -> dict[str, Any]:
    return triage_symptoms(symptoms)

  def summarise(self, text: str) -> dict[str, str]:
    return generate_clinician_summary(text)

  def chat(
    self,
    message: str,
    context: str | None = None,
    *,
    evidence_items: list[PromptEvidenceItem] | None = None,
  ) -> dict[str, Any]:
    return chat_with_copilot(message, context=context, evidence_items=evidence_items)

  def embed(
    self,
    texts: list[str],
    *,
    allow_heuristic_fallback: bool = True,
    throttle_seconds: float | None = None,
    batch_size: int | None = None,
    max_retries: int | None = None,
    request_timeout_seconds: float | None = None,
  ) -> tuple[list[list[float]], str]:
    return embed_texts(
      texts,
      allow_heuristic_fallback=allow_heuristic_fallback,
      throttle_seconds=throttle_seconds,
      batch_size=batch_size,
      max_retries=max_retries,
      request_timeout_seconds=request_timeout_seconds,
    )

  def embed_detailed(
    self,
    texts: list[str],
    *,
    allow_heuristic_fallback: bool = True,
    throttle_seconds: float | None = None,
    batch_size: int | None = None,
    max_retries: int | None = None,
    request_timeout_seconds: float | None = None,
  ) -> EmbeddingBatchResult:
    return embed_texts_detailed(
      texts,
      allow_heuristic_fallback=allow_heuristic_fallback,
      throttle_seconds=throttle_seconds,
      batch_size=batch_size,
      max_retries=max_retries,
      request_timeout_seconds=request_timeout_seconds,
    )


@lru_cache(maxsize=1)
def get_ai_provider() -> AIProvider:
  return AIProvider()
