"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Search } from "lucide-react";
import { mockEvidenceResults } from "../mock-data/knowledge-center";
import { apiClient, ApiError } from "@/lib/api";
import type { AiMode, EvidenceSearchResponse, ResultMode } from "@/lib/contracts";
import { useAppState } from "@/hooks/useAppState";
import {
  buildEmptyStateMessage,
  mapEvidenceSources,
  type KnowledgeEvidenceItem,
} from "./view-model";
import { EmptyState, ErrorState, SkeletonCard } from "../shared/PageStates";

type EvidenceItem = KnowledgeEvidenceItem;

function buildDemoEvidenceResponse(query: string): EvidenceSearchResponse {
  return {
    query,
    sources: mockEvidenceResults.map((item, index) => ({
      id: item.id,
      title: item.title,
      snippet: item.summary,
      source: item.source,
      url: null,
      section: null,
      page: null,
      score: 1 - index * 0.1,
    })),
    mode: "demo",
    ai_mode: null,
    latency_ms: 0,
    error_message: null,
  };
}

function modeLabel(mode: ResultMode): string {
  if (mode === "real") return "Connected";
  if (mode === "fallback") return "Connected fallback";
  if (mode === "demo") return "Demo";
  return "Error";
}

export function KnowledgeCenterPage() {
  const { demoMode } = useAppState();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EvidenceItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ResultMode>("real");
  const [aiMode, setAiMode] = useState<AiMode>(null);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const runSearch = async (term: string) => {
    const query = term.trim();
    if (!query) return;
    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.searchEvidence(query, {
        demoMode,
        fallback: () => buildDemoEvidenceResponse(query),
        fallbackMessage: "Demo mode is enabled. Showing demo evidence content.",
      });

      const response = result.data;
      const nextMode = response.mode;
      setMode(nextMode);
      setAiMode(result.data.ai_mode);
      setFallbackReason(response.fallback_reason ?? null);
      setLatencyMs(response.latency_ms);
      setError(response.error_message ?? result.warning ?? null);

      if (nextMode === "error") {
        setResults(null);
        console.warn(
          "[KnowledgeCenter] search failed mode=%s latency_ms=%s query=%s",
          nextMode,
          response.latency_ms,
          query,
        );
        return;
      }

      setResults(mapEvidenceSources(response.sources));
      console.info(
        "[KnowledgeCenter] search completed mode=%s ai_mode=%s latency_ms=%s result_count=%s query=%s",
        nextMode,
        response.ai_mode,
        response.latency_ms,
        response.sources.length,
        query,
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiError
          ? caughtError.message
          : "Unable to reach the evidence service.";
      setResults(null);
      setMode("error");
      setAiMode(null);
      setFallbackReason(null);
      setLatencyMs(null);
      setError(message);
      console.warn("[KnowledgeCenter] request error query=%s message=%s", query, message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => runSearch(query);

  // Deep links from result views arrive as /knowledge-center?query=...; run once on mount.
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("query");
    if (initial && initial.trim()) {
      setQuery(initial);
      void runSearch(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Knowledge Center"
        subtitle="Search clinical guidelines and evidence from the local index."
      />

      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input
              placeholder="Search guidelines, evidence, or clinical topics..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="rounded-[14px] border-border-subtle pl-9"
            />
          </div>
          <Button onClick={handleSearch} className="gap-2" disabled={loading}>
            <Search className="h-4 w-4" />
            {loading ? "Searching…" : "Search"}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone={mode === "real" ? "success" : mode === "fallback" ? "warning" : mode === "demo" ? "outline" : "danger"}>
            {modeLabel(mode)}
          </Badge>
          {aiMode ? (
            <span className="text-[11px] text-text-secondary">AI processing: {aiMode}</span>
          ) : null}
          {fallbackReason ? (
            <span className="text-[11px] text-text-secondary">Fallback reason: {fallbackReason}</span>
          ) : null}
          {latencyMs != null ? (
            <span className="text-[11px] text-text-secondary">Latency: {latencyMs} ms</span>
          ) : null}
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={index} lines={4} />
            ))}
          </div>
        ) : results && results.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {results.map((item) => (
              <Card
                key={item.id}
                className={`rounded-[20px] border shadow-soft ${
                  item.usedInAnswer
                    ? "border-primary bg-primary-soft/50"
                    : "border-border-subtle bg-white"
                }`}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-semibold text-text-primary">
                    {item.title}
                  </CardTitle>
                  {item.usedInAnswer && (
                    <Badge tone="none" className="bg-primary text-[10px] text-white">
                      Used in this answer
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-text-secondary">{item.source}</p>
                  {item.section || item.page ? (
                    <p className="mt-1 text-[11px] text-text-tertiary">
                      {[item.section, item.page != null ? `Page ${item.page}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs leading-relaxed text-text-primary">
                    {item.summary}
                  </p>
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-[11px] text-primary hover:underline"
                    >
                      Open source
                    </a>
                  ) : null}
                  {typeof item.score === "number" ? (
                    <p className="mt-2 text-[11px] text-text-tertiary">
                      Relevance score: {item.score.toFixed(2)}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : mode === "error" ? (
          <ErrorState
            title="Evidence search is unavailable"
            description={buildEmptyStateMessage(mode, query)}
            onRetry={query.trim() ? handleSearch : undefined}
            retryLabel="Retry search"
          />
        ) : (
          <EmptyState
            icon={BookOpen}
            title={query.trim() ? "No evidence matched" : "Search the local evidence index"}
            description={buildEmptyStateMessage(mode, query)}
            action={
              query.trim() ? (
                <Button variant="outline" onClick={handleSearch}>
                  Retry search
                </Button>
              ) : undefined
            }
          />
        )}
        {error ? <p className="text-[11px] text-danger-text-alt">{error}</p> : null}
      </div>
    </div>
  );
}
