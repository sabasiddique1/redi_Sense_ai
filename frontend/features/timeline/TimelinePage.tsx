"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, SkeletonCard } from "../shared/PageStates";
import { Badge } from "@/components/ui/badge";
import { Clock, FileText, Pill, Stethoscope, Sparkles } from "lucide-react";
import { mockTimelineEvents } from "../mock-data/timeline";
import { apiClient, ApiError } from "@/lib/api";
import type { ResultMode, TimelineEventResponse } from "@/lib/contracts";
import { useAppState } from "@/hooks/useAppState";

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  report: FileText,
  medication: Pill,
  symptom: Stethoscope,
  finding: Sparkles,
};

type TimelineEvent = (typeof mockTimelineEvents)[number];

function normalizeTimelineType(eventType: string): TimelineEvent["type"] {
  if (eventType.includes("report")) return "report";
  if (eventType.includes("medication")) return "medication";
  if (eventType.includes("triage") || eventType.includes("symptom")) return "symptom";
  return "finding";
}

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

function mapTimelineResponse(event: TimelineEventResponse): TimelineEvent {
  const metadata = event.metadata ?? {};
  const findingsSource = Array.isArray(metadata.findings)
    ? metadata.findings
    : Array.isArray(metadata.key_findings)
      ? metadata.key_findings
      : Array.isArray(metadata.red_flags)
        ? metadata.red_flags
        : [];
  const findings = findingsSource.filter((item): item is string => typeof item === "string");

  return {
    id: String(event.id),
    type: normalizeTimelineType(event.event_type),
    title: event.title,
    detail: event.summary,
    date: new Date(event.timestamp).toLocaleDateString(),
    time: new Date(event.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    findings,
  };
}

function modeLabel(mode: ResultMode): string {
  if (mode === "real") return "Connected";
  if (mode === "fallback") return "Connected fallback";
  if (mode === "demo") return "Demo";
  return "Error";
}

export function TimelinePage() {
  const {
    demoMode,
    selectedPatient,
    selectedPatientId,
    activityVersion,
    lastActivityMessage,
  } = useAppState();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ResultMode>("real");

  useEffect(() => {
    if (!selectedPatientId) {
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
        if (cancelled) {
          return;
        }
        setEvents(result.data.map(mapTimelineResponse));
        setMode(result.mode);
        setError(result.warning ?? null);
      } catch (caughtError) {
        if (cancelled) {
          return;
        }
        const message =
          caughtError instanceof ApiError
            ? caughtError.message
            : "Unable to load the connected patient timeline.";
        setEvents([]);
        setMode("error");
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activityVersion, demoMode, selectedPatientId]);

  const visibleEvents = selectedPatientId ? events : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Patient Timeline"
        subtitle={
          selectedPatient
            ? `Chronological view of ${selectedPatient.name}'s reports, triage runs, and findings.`
            : "Chronological view of reports, medications, symptom checks, and findings."
        }
      />

      <div className="max-w-2xl space-y-3">
        <div className="flex items-center gap-2">
          <Badge tone={mode === "real" ? "success" : mode === "fallback" ? "warning" : mode === "demo" ? "outline" : "danger"}>
            {modeLabel(mode)}
          </Badge>
          {lastActivityMessage ? (
            <span className="text-[11px] text-primary-strong">{lastActivityMessage}</span>
          ) : null}
        </div>

        {loading && visibleEvents.length === 0 ? (
          <div className="space-y-4" aria-busy="true">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex gap-4">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <SkeletonCard lines={2} className="flex-1" />
              </div>
            ))}
          </div>
        ) : visibleEvents.length > 0 ? (
          <div className="relative">
            <div className="absolute bottom-0 left-4 top-0 w-px bg-border-subtle" />

            <div className="space-y-4">
              {visibleEvents.map((event) => (
                <div key={event.id} className="relative flex gap-4">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow-[0_2px_8px_rgba(76,141,255,0.3)]">
                    {EVENT_ICONS[event.type] ? (
                      (() => {
                        const Icon = EVENT_ICONS[event.type];
                        return <Icon className="h-4 w-4" />;
                      })()
                    ) : (
                      <span className="text-xs font-semibold">{event.type.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <Card className="rounded-[20px] border border-border-subtle bg-white shadow-soft">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-text-tertiary">
                            {event.date} · {event.time}
                          </span>
                          <Badge tone="outline" className="text-[10px]">
                            {event.type}
                          </Badge>
                        </div>
                        <h3 className="mt-1 text-sm font-semibold text-text-primary">
                          {event.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-text-secondary">
                          {event.detail}
                        </p>
                        {event.findings && event.findings.length > 0 ? (
                          <ul className="mt-2 space-y-0.5 text-[11px] text-text-secondary">
                            {event.findings.map((finding) => (
                              <li key={finding} className="flex items-start gap-2">
                                <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                                {finding}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : mode === "error" ? (
          <ErrorState
            title="The connected timeline is unavailable"
            description="Restore the backend service or enable demo mode explicitly from Settings."
          />
        ) : (
          <EmptyState
            icon={Clock}
            title="No timeline events yet"
            description="Report analyses and triage runs for the selected patient will appear here in chronological order."
          />
        )}
        {error ? (
          <p className="text-[11px] text-danger-text-alt">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
