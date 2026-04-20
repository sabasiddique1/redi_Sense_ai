from __future__ import annotations

from dataclasses import dataclass


COPILOT_RAG_PROMPT_VERSION = "2026-04-06.copilot-rag-v1"


@dataclass(frozen=True)
class PromptEvidenceItem:
  citation_id: str
  title: str
  excerpt: str
  source: str | None = None
  url: str | None = None
  section: str | None = None
  page: int | None = None
  score: float | None = None


def format_evidence_for_prompt(items: list[PromptEvidenceItem]) -> str:
  if not items:
    return "No evidence passages were retrieved for this question."

  blocks: list[str] = []
  for item in items:
    metadata = " | ".join(
      part
      for part in [
        f"id={item.citation_id}",
        item.title,
        item.source,
        item.section,
        f"page={item.page}" if item.page is not None else None,
        f"score={item.score:.2f}" if item.score is not None else None,
      ]
      if part
    )
    blocks.append(
      "\n".join(
        [
          f"[{item.citation_id}] {metadata}",
          item.excerpt.strip(),
        ]
      )
    )
  return "\n\n".join(blocks)


def build_copilot_rag_prompts(
  *,
  question: str,
  patient_context: str | None,
  evidence_items: list[PromptEvidenceItem],
) -> tuple[str, str]:
  evidence_context = format_evidence_for_prompt(evidence_items)
  patient_block = patient_context.strip() if patient_context else "No patient context provided."

  system_prompt = (
    "You are ReportIQ, a healthcare copilot that must answer conservatively and stay grounded. "
    "Use only the supplied patient context and retrieved evidence passages. "
    "Do not invent diagnoses, source citations, treatment orders, or facts that are not present. "
    "If the evidence is insufficient for the question, say so clearly. "
    "Citations must reference only the provided evidence ids. "
    "Return JSON with keys: reply, citation_ids, insufficient_evidence."
  )
  user_prompt = (
    f"Prompt version: {COPILOT_RAG_PROMPT_VERSION}\n\n"
    "Patient context:\n"
    f"{patient_block}\n\n"
    "Retrieved evidence:\n"
    f"{evidence_context}\n\n"
    "Instructions:\n"
    "- Answer the question using the retrieved evidence first, then use patient context only for relevance and personalization.\n"
    "- If retrieved evidence does not support a direct answer, say that the evidence is insufficient.\n"
    "- Keep wording clinical, cautious, and non-diagnostic.\n"
    "- citation_ids must contain only evidence ids that directly support the answer.\n\n"
    f"Question:\n{question}"
  )
  return system_prompt, user_prompt
