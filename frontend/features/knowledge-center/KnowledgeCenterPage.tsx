"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModeBadge } from "@/components/ui/mode-badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/components/ui/cn";
import { useAppState } from "@/hooks/useAppState";
import { apiClient, ApiError } from "@/lib/api";
import type { AiMode, EvidenceSearchResponse, ResultMode } from "@/lib/contracts";
import { mockEvidenceResults } from "../mock-data/knowledge-center";
import { PageHeader } from "../shared/PageHeader";
import { EmptyState, ErrorState, SkeletonCard } from "../shared/PageStates";
import { buildEmptyStateMessage, mapEvidenceSources, type KnowledgeEvidenceItem } from "./view-model";

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

const ALL = "__all__";

export function KnowledgeCenterPage() {
  const { demoMode, hydrated, openCopilot } = useAppState();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeEvidenceItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ResultMode>("real");
  const [aiMode, setAiMode] = useState<AiMode>(null);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>(ALL);
  const [sectionFilter, setSectionFilter] = useState<string>(ALL);

  const runSearch = async (term: string) => {
    const nextQuery = term.trim();
    if (!nextQuery) return;
    setLoading(true);
    setError(null);
    setSourceFilter(ALL);
    setSectionFilter(ALL);

    try {
      const result = await apiClient.searchEvidence(nextQuery, {
        demoMode,
        fallback: () => buildDemoEvidenceResponse(nextQuery),
        fallbackMessage: "Demo mode is enabled. Showing demo evidence content.",
      });
      const response = result.data;
      setMode(response.mode);
      setAiMode(response.ai_mode);
      setFallbackReason(response.fallback_reason ?? null);
      setLatencyMs(response.latency_ms);
      setError(response.error_message ?? result.warning ?? null);
      if (response.mode === "error") {
        setResults(null);
        return;
      }
      setResults(mapEvidenceSources(response.sources));
    } catch (caughtError) {
      setResults(null);
      setMode("error");
      setAiMode(null);
      setFallbackReason(null);
      setLatencyMs(null);
      setError(caughtError instanceof ApiError ? caughtError.message : "Unable to reach the evidence service.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => runSearch(query);

  // Deep links from result views arrive as /knowledge-center?query=...; run once after hydration.
  useEffect(() => {
    if (!hydrated) return;
    const initial = new URLSearchParams(window.location.search).get("query");
    if (initial && initial.trim()) {
      setQuery(initial);
      void runSearch(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const sources = useMemo(() => Array.from(new Set((results ?? []).map((item) => item.source).filter(Boolean))), [results]);
  const sections = useMemo(() => Array.from(new Set((results ?? []).map((item) => item.section).filter((s): s is string => Boolean(s)))), [results]);
  const filtered = useMemo(
    () => (results ?? []).filter((item) => (sourceFilter === ALL || item.source === sourceFilter) && (sectionFilter === ALL || item.section === sectionFilter)),
    [results, sourceFilter, sectionFilter],
  );
  const facets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of results ?? []) counts.set(item.source || "Unknown", (counts.get(item.source || "Unknown") ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [results]);

  return (
    <div className="space-y-5">
      <PageHeader title="Knowledge Center" subtitle="Search clinical guidelines and evidence from the local index." />

      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
            <Input
              placeholder="Search guidelines, evidence, or clinical topics…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleSearch()}
              className="pl-9"
              aria-label="Search evidence"
            />
          </div>
          <Button onClick={handleSearch} className="gap-2" disabled={loading} loading={loading}>
            <Search className="h-4 w-4" aria-hidden="true" />
            {loading ? "Searching…" : "Search"}
          </Button>
        </div>

        {results && results.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">Filters</span>
            {sources.length > 1 ? (
              <SegmentedControl
                label="Source"
                variant="chip"
                value={sourceFilter}
                onChange={setSourceFilter}
                options={[{ value: ALL, label: "All sources" }, ...sources.map((source) => ({ value: source, label: source }))]}
              />
            ) : null}
            {sections.length > 0 ? (
              <label className="inline-flex items-center gap-1.5 text-xs text-ink-700">
                <span className="sr-only">Section</span>
                <select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)} className="h-8 rounded-pill border border-border-hairline bg-surface px-3 text-xs text-ink-700">
                  <option value={ALL}>Section ▾</option>
                  {sections.map((section) => (
                    <option key={section} value={section}>
                      {section}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {/* Date filter from the design is omitted: evidence chunks carry no publication date. */}
            <span className="ml-auto text-2xs text-ink-500 rs-tabular">{filtered.length} results</span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-500">
          <ModeBadge mode={mode} />
          {results ? (
            <span className="rs-tabular">
              {results.length} results
              {facets.map(([source, count]) => (
                <span key={source}>
                  {" "}· <span className="font-semibold text-ink-700">{count}</span> {source}
                </span>
              ))}
            </span>
          ) : null}
          {aiMode ? <span>AI processing: {aiMode}</span> : null}
          {fallbackReason ? <span>Fallback: {fallbackReason}</span> : null}
          {latencyMs != null ? <span className="rs-tabular">Latency: {latencyMs} ms</span> : null}
        </div>

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonCard key={index} lines={3} />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <ol className="space-y-3">
            {filtered.map((item, index) => (
              <li key={item.id} className="card-surface grid gap-4 p-5 lg:grid-cols-[88px_minmax(0,1fr)]">
                <div className="flex flex-row items-center gap-2 lg:flex-col lg:items-start lg:gap-0">
                  <span className={cn("text-2xl font-semibold tracking-[-0.01em] rs-tabular", (item.score ?? 0) >= 0.8 ? "text-accent-700" : "text-ink-700")}>{item.score != null ? item.score.toFixed(2) : "—"}</span>
                  <span className="text-2xs uppercase tracking-[0.05em] text-ink-400">score</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-ink-900">
                    <span className="mr-2 font-mono text-2xs text-accent-700">[{index + 1}]</span>
                    {item.title}
                  </h2>
                  <p className="mt-0.5 text-2xs text-ink-500">
                    {[item.source, item.section, item.page != null ? `Page ${item.page}` : null].filter(Boolean).join(" · ")}
                  </p>
                  <blockquote className="mt-3 border-l-2 border-accent-100 pl-3 text-xs leading-relaxed text-ink-700">“{item.summary}”</blockquote>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => openCopilot(`Summarize what "${item.title}" says about ${query.trim() || "this topic"} and how it applies to the current patient.`)} className="inline-flex items-center gap-1 text-xs font-semibold text-accent-700 hover:underline">
                      Ask Copilot about this
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-ink-500 hover:text-ink-900 hover:underline">
                        Open source
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : mode === "error" ? (
          <ErrorState title="Evidence search is unavailable" description={buildEmptyStateMessage(mode, query)} onRetry={query.trim() ? handleSearch : undefined} retryLabel="Retry search" />
        ) : (
          <EmptyState
            icon={BookOpen}
            title={results && results.length > 0 ? "No matching evidence found" : query.trim() ? "No evidence matched" : "Search the local evidence index"}
            description={results && results.length > 0 ? "Broaden the query or clear the source/section filters." : buildEmptyStateMessage(mode, query)}
            action={
              results && results.length > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSourceFilter(ALL);
                    setSectionFilter(ALL);
                  }}
                >
                  Clear filters
                </Button>
              ) : query.trim() ? (
                <Button variant="outline" onClick={handleSearch}>
                  Retry search
                </Button>
              ) : undefined
            }
          />
        )}
        {error && mode !== "error" ? <p className="text-2xs text-severity-moderate">{error}</p> : null}
      </div>
    </div>
  );
}
