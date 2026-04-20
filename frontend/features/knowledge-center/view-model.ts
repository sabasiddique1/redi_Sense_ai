import type { EvidenceSearchResponse, ResultMode } from "../../lib/contracts";

export type KnowledgeEvidenceItem = {
  id: string;
  title: string;
  source: string;
  summary: string;
  usedInAnswer: boolean;
  url: string | null;
  section: string | null;
  page: number | null;
  score?: number;
};

export function mapEvidenceSources(
  sources: EvidenceSearchResponse["sources"],
): KnowledgeEvidenceItem[] {
  return sources.map((source) => ({
    id: source.id,
    title: source.title,
    source: source.source ?? source.url ?? "",
    summary: source.snippet,
    usedInAnswer: false,
    url: source.url,
    section: source.section,
    page: source.page,
    score: source.score,
  }));
}

export function buildEmptyStateMessage(
  mode: ResultMode,
  query: string,
): string {
  if (mode === "error") {
    return "Evidence search is unavailable in connected mode. Restore the backend service or enable demo mode explicitly.";
  }
  if (query.trim()) {
    return "No evidence matched this query in the current local index.";
  }
  return "Enter a search term to retrieve guideline summaries and evidence.";
}
