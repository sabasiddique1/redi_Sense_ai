"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";

import { Heatmap, HeatmapLoading } from "@/components/charts/Heatmap";
import { StepLine, StepLineLoading } from "@/components/charts/StepLine";
import { ModeBadge } from "@/components/ui/mode-badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TimelineItem } from "@/components/ui/timeline-item";
import { useAppState } from "@/hooks/useAppState";
import { apiClient, ApiError } from "@/lib/api";
import type { ResultMode, TimelineEventResponse } from "@/lib/contracts";
import { mockTimelineEvents } from "../mock-data/timeline";
import { PageHeader } from "../shared/PageHeader";
import { EmptyState, ErrorState, SkeletonCard } from "../shared/PageStates";
import { dailyCounts, groupByDay, heatmapCaption, mapTimelineEvent, severityByDay, severityCaption, type TimelineFilter, type TimelineViewEvent } from "./view-model";

function buildDemoTimeline(): TimelineEventResponse[] {
  return mockTimelineEvents.map((event) => ({
    id: Number(event.id),
    patient_id: 1,
    event_type: event.type,
    title: event.title,
    summary: event.detail,
    metadata: { findings: event.findings ?? [] },
    timestamp: new Date(`${event.date}T${event.time}:00`).toISOString(),
  }));
}

const FILTERS: { value: TimelineFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "report", label: "Reports" },
  { value: "triage", label: "Triage" },
  { value: "copilot", label: "Copilot" },
  { value: "alert", label: "Alerts" },
];

export function TimelinePage() {
  const { demoMode, selectedPatient, selectedPatientId, activityVersion, lastActivityMessage, hydrated } = useAppState();
  const [events, setEvents] = useState<TimelineViewEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ResultMode>("real");
  const [filter, setFilter] = useState<TimelineFilter>("all");

  useEffect(() => {
    if (!hydrated) return;
    if (!selectedPatientId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const result = await apiClient.fetchTimeline(selectedPatientId, {
          demoMode,
          fallback: buildDemoTimeline,
          fallbackMessage: "Demo mode is enabled. Showing demo timeline.",
        });
        if (cancelled) return;
        setEvents(result.data.map(mapTimelineEvent));
        setMode(result.mode);
        setError(result.warning ?? null);
      } catch (caughtError) {
        if (cancelled) return;
        setEvents([]);
        setMode("error");
        setError(caughtError instanceof ApiError ? caughtError.message : "Unable to load the connected patient timeline.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [activityVersion, demoMode, selectedPatientId, hydrated]);

  const visible = useMemo(() => (selectedPatientId ? events.filter((e) => filter === "all" || e.filter === filter) : []), [events, filter, selectedPatientId]);
  const groups = useMemo(() => groupByDay(visible), [visible]);
  const heat = useMemo(() => dailyCounts(events), [events]);
  const severity = useMemo(() => severityByDay(events), [events]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Patient Timeline"
        subtitle={selectedPatient ? `Chronological view of ${selectedPatient.name}'s reports, triage runs, and findings.` : "Chronological view of reports, medications, symptom checks, and findings."}
      />

      <div className="flex flex-wrap items-center gap-2 text-2xs text-ink-500">
        <ModeBadge mode={mode} />
        {lastActivityMessage ? <span className="text-accent-700">{lastActivityMessage}</span> : null}
        {error && mode !== "error" ? <span>{error}</span> : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="flex items-center gap-3 overflow-x-auto">
            <span className="text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">Filter</span>
            <SegmentedControl label="Event type" variant="chip" value={filter} onChange={setFilter} options={FILTERS} />
          </div>

          {loading && events.length === 0 ? (
            <div className="space-y-3" aria-busy="true">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonCard key={index} lines={2} />
              ))}
            </div>
          ) : mode === "error" ? (
            <ErrorState title="The connected timeline is unavailable" description="Restore the backend service or enable demo mode explicitly from Settings." />
          ) : groups.length === 0 ? (
            <EmptyState icon={Clock} title={events.length ? "No events match this filter" : "No timeline events yet"} description={events.length ? "Choose another event type." : "Report analyses and triage runs for the selected patient will appear here in chronological order."} />
          ) : (
            <div className="space-y-5">
              {groups.map((group) => (
                <section key={group.key} aria-label={group.label} className="card-surface p-5">
                  <h2 className="text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">{group.label}</h2>
                  <ol className="mt-3 space-y-3">
                    {group.events.map((event) => (
                      <TimelineItem key={event.id} time={event.time} title={event.title} detail={event.detail} type={event.type} risk={event.risk}>
                        {event.findings.length > 0 ? (
                          <ul className="mt-1.5 space-y-0.5 text-2xs text-ink-500">
                            {event.findings.map((finding) => (
                              <li key={finding} className="flex items-start gap-2">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent-600" aria-hidden="true" />
                                {finding}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </TimelineItem>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
          <section className="card-surface p-5" aria-labelledby="timeline-heatmap-title">
            <h2 id="timeline-heatmap-title" className="text-sm font-semibold text-ink-900">Activity heatmap</h2>
            <p className="mt-0.5 text-2xs text-ink-500">30 days, all event types</p>
            <div className="mt-3">
              {loading && events.length === 0 ? <HeatmapLoading rows={3} /> : <Heatmap values={heat.values} labels={heat.labels} columns={10} title="Activity over the last 30 days" caption={heatmapCaption(heat.values, heat.labels)} />}
            </div>
          </section>
          <section className="card-surface p-5" aria-labelledby="timeline-severity-title">
            <h2 id="timeline-severity-title" className="text-sm font-semibold text-ink-900">Severity over time</h2>
            <p className="mt-0.5 text-2xs text-ink-500">event-level risk, last 7 days</p>
            <div className="mt-3">{loading && events.length === 0 ? <StepLineLoading /> : <StepLine points={severity} title="Highest event severity per day" />}</div>
            <p className="mt-2 text-2xs text-ink-700">{severityCaption(severity)}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
