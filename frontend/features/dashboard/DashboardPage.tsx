"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Lightbulb, MoreHorizontal } from "lucide-react";

import { useAppState } from "@/hooks/useAppState";
import { ApiError, apiClient } from "@/lib/api";
import type { ResultMode } from "@/lib/contracts";
import { ConfidenceRing } from "@/components/charts/ConfidenceRing";
import { DonutChart, DonutChartEmpty } from "@/components/charts/DonutChart";
import { HourlyAreaChart, HourlyAreaChartEmpty } from "@/components/charts/HourlyAreaChart";
import { SeverityStackedBar } from "@/components/charts/SeverityStackedBar";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn, type SortState } from "@/components/ui/data-table";
import { DisclaimerBar } from "@/components/ui/disclaimer-bar";
import { ModeBadge } from "@/components/ui/mode-badge";
import { SeverityChip } from "@/components/ui/severity-chip";
import { StatCard } from "@/components/ui/stat-card";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { TimelineItem } from "@/components/ui/timeline-item";
import { cn } from "@/components/ui/cn";
import { PageHeader } from "../shared/PageHeader";
import { EmptyState, ErrorState, SkeletonCard } from "../shared/PageStates";
import { riskClasses, riskIndex, isEscalationLevel } from "../shared/risk";
import { buildDemoDashboardSummary } from "../mock-data/dashboard";
import { formatMinutes, mapDashboardSummary, type DashboardViewData, type QueueRow } from "./view-model";

const PAGE_SIZE = 4;

function greetingForHour(hour: number): string {
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

function CardHeading({ title, caption, action }: { title: string; caption?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {caption ? <p className="mt-0.5 text-2xs text-ink-500">{caption}</p> : null}
      </div>
      {action}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} lines={2} />
        ))}
      </section>
      <SkeletonCard lines={4} />
      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <SkeletonCard lines={6} />
          <SkeletonCard lines={3} />
        </div>
        <div className="space-y-4">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </div>
      </section>
    </div>
  );
}

const QUEUE_FILTERS = [{ id: "high-critical", label: "High + Critical" }];

export function DashboardPage() {
  const { demoMode, activityVersion, user, hydrated } = useAppState();
  const [data, setData] = useState<DashboardViewData | null>(null);
  const [mode, setMode] = useState<ResultMode>("real");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("Welcome");
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState("");
  const [highOnly, setHighOnly] = useState(false);
  const [density, setDensity] = useState<"compact" | "comfortable">("compact");
  const [sort, setSort] = useState<SortState>({ column: "risk", direction: "desc" });
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const result = await apiClient.fetchDashboardSummary({
          demoMode,
          fallback: buildDemoDashboardSummary,
          fallbackMessage: "Demo mode is enabled. Showing the demo dashboard snapshot.",
        });
        if (cancelled) return;
        setData(mapDashboardSummary(result.data));
        setMode(result.mode);
        setError(result.warning ?? null);
      } catch (caughtError) {
        if (cancelled) return;
        setData(null);
        setMode("error");
        setError(caughtError instanceof ApiError ? caughtError.message : "Unable to load the connected dashboard summary.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [demoMode, activityVersion, reloadKey, hydrated]);

  const filteredQueue = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    let rows = data.queue.filter((row) => {
      if (highOnly && !isEscalationLevel(row.risk)) return false;
      if (!term) return true;
      return row.patientName.toLowerCase().includes(term) || row.mrn.toLowerCase().includes(term);
    });
    if (sort) {
      const direction = sort.direction === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        if (sort.column === "risk") return (riskIndex(a.risk) - riskIndex(b.risk)) * direction;
        if (sort.column === "patient") return a.patientName.localeCompare(b.patientName) * direction;
        return 0;
      });
    }
    return rows;
  }, [data, search, highOnly, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredQueue.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredQueue.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const columns: DataTableColumn<QueueRow>[] = [
    { id: "patient", header: "Patient", sortable: true, cell: (row) => <span className="font-semibold text-ink-900">{row.patientName}</span> },
    { id: "mrn", header: "MRN", mono: true, cell: (row) => <span className="text-ink-500">{row.mrn}</span> },
    { id: "modality", header: "Modality", cell: (row) => <span className="text-ink-700">{row.modality}</span> },
    { id: "summary", header: "AI summary", cell: (row) => <span className="line-clamp-2 text-ink-700">{row.summary}</span>, width: "34%" },
    {
      id: "risk",
      header: "Risk / confidence / time in queue",
      sortable: true,
      cell: (row) => (
        <span className="flex items-center gap-2">
          <SeverityChip level={row.risk} />
          <ConfidenceRing value={row.confidence} size={24} title="Confidence" color={riskClasses(row.risk).cssVar} />
          <span className="font-mono text-2xs text-ink-500 rs-tabular">{formatMinutes(row.minutesInQueue)}</span>
        </span>
      ),
    },
  ];

  const showSkeleton = loading && !data;
  const showError = !loading && !data && mode === "error";

  return (
    <div className="space-y-5">
      <PageHeader title={`${greeting}, ${user.name}`} subtitle="Here’s a snapshot of today’s report risk, triage queue, and key AI findings." />

      <div className="flex flex-wrap items-center gap-2 text-2xs text-ink-500">
        <ModeBadge mode={mode} />
        {loading && data ? <span>Refreshing…</span> : null}
        {error && mode !== "error" ? <span>{error}</span> : null}
      </div>

      {showSkeleton ? <DashboardSkeleton /> : null}

      {showError ? (
        <ErrorState title="The connected dashboard is unavailable" description={error ?? "Restore the backend service or enable demo mode explicitly from Settings."} onRetry={retry} />
      ) : null}

      {data ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Key metrics">
            {data.metrics.map((metric) => (
              <StatCard key={metric.label} {...metric} />
            ))}
          </section>

          <section className="card-surface p-5" aria-label="Today at a glance">
            <CardHeading title="Today at a glance" />
            <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_0.8fr_1.3fr]">
              <div>
                <p className="text-2xs font-semibold uppercase tracking-[0.04em] text-ink-500">
                  Reports by risk <span className="font-normal normal-case tracking-normal text-ink-400">· count</span>
                </p>
                <div className="mt-3">
                  <SeverityStackedBar buckets={data.reportsByRisk} height={16} legend="inline" title="Today's reports by risk" />
                </div>
                {data.reportsByRiskCaption ? <p className="mt-3 text-xs text-ink-700">{data.reportsByRiskCaption}</p> : null}
              </div>
              <div>
                <p className="text-2xs font-semibold uppercase tracking-[0.04em] text-ink-500">
                  Reports by modality <span className="font-normal normal-case tracking-normal text-ink-400">· % of {data.modalityTotal}</span>
                </p>
                <div className="mt-3">
                  {data.modality.length > 0 ? (
                    <DonutChart segments={data.modality} centerValue={String(data.modalityTotal)} centerLabel="reports" size={120} title="Reports by modality" />
                  ) : (
                    <DonutChartEmpty size={120} message="No reports in the last 7 days" />
                  )}
                </div>
              </div>
              <div>
                <p className="text-2xs font-semibold uppercase tracking-[0.04em] text-ink-500">
                  Reports analyzed, {data.hourly[0]?.label ?? "06:00"}–now <span className="font-normal normal-case tracking-normal text-ink-400">· count/hr</span>
                </p>
                <div className="mt-3">
                  {data.hourly.length >= 2 ? (
                    <HourlyAreaChart points={data.hourly} target={data.hourlyTarget} targetLabel={data.hourlyTarget != null ? `target: ${data.hourlyTarget}/hr` : undefined} height={90} title="Reports analyzed per hour" />
                  ) : (
                    <HourlyAreaChartEmpty height={90} message="Not enough hourly data yet" />
                  )}
                </div>
                {data.hourlyCaption ? <p className="mt-2 text-xs text-ink-700">{data.hourlyCaption}</p> : null}
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-4">
              <div className="card-surface p-5">
                <CardHeading title="Reports queue" caption="Sorted by risk, newest first" action={<span className="text-2xs text-ink-400 rs-tabular">{filteredQueue.length} in queue</span>} />
                <TableToolbar
                  className="mt-4"
                  searchValue={search}
                  searchPlaceholder="Search patient or MRN"
                  onSearchChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  filters={QUEUE_FILTERS.map((filter) => ({ ...filter, active: highOnly }))}
                  onToggleFilter={() => {
                    setHighOnly((v) => !v);
                    setPage(1);
                  }}
                  density={density}
                  onDensityChange={setDensity}
                />
                <div className="mt-3">
                  {filteredQueue.length === 0 ? (
                    <EmptyState
                      title="No reports match these filters"
                      description="Clear filters to see the full queue."
                      action={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearch("");
                            setHighOnly(false);
                          }}
                        >
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <DataTable caption="Reports queue" columns={columns} rows={pageRows} rowKey={(row) => row.id} sort={sort} onSortChange={setSort} onRowSelect={(row) => setSelectedRow(row.id)} selectedKey={selectedRow} density={density} />
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between text-2xs text-ink-500">
                  <span className="rs-tabular">{data.reportsTotal} reports on record</span>
                  <nav className="inline-flex items-center gap-1" aria-label="Queue pages">
                    <button type="button" className="rounded-sm p-1 hover:bg-surface-sunken disabled:opacity-40" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} aria-label="Previous page">
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    {Array.from({ length: pageCount }).map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        aria-current={currentPage === index + 1 ? "page" : undefined}
                        onClick={() => setPage(index + 1)}
                        className={cn("min-w-6 rounded-sm px-1.5 py-0.5 rs-tabular", currentPage === index + 1 ? "bg-ink-900 text-surface" : "hover:bg-surface-sunken")}
                      >
                        {index + 1}
                      </button>
                    ))}
                    <button type="button" className="rounded-sm p-1 hover:bg-surface-sunken disabled:opacity-40" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={currentPage === pageCount} aria-label="Next page">
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </nav>
                </div>
              </div>

              <div className="card-surface p-5">
                <CardHeading title="Recent activity" />
                {data.activity.length === 0 ? (
                  <p className="mt-3 text-xs text-ink-400">No activity yet.</p>
                ) : (
                  <div className="mt-3 space-y-4">
                    {data.activity.map((group) => (
                      <div key={group.hour}>
                        <p className="mb-2 font-mono text-2xs text-ink-400 rs-tabular">{group.hour}</p>
                        <ul className="space-y-2">
                          {group.items.map((item) => (
                            <TimelineItem key={item.id} compact time={item.time} title={item.title} detail={item.detail} type={item.type} />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="card-surface p-5">
                <CardHeading title="Risk distribution" caption={`Triage sessions, last ${data.riskWindowDays} days`} action={<MoreHorizontal className="h-4 w-4 text-ink-400" aria-hidden="true" />} />
                <div className="mt-3">
                  <SeverityStackedBar buckets={data.riskDistribution} height={12} legend="list" title="Risk distribution" />
                </div>
              </div>

              <div className="card-surface p-5 shadow-elevation-2">
                <CardHeading title="Urgent alerts" caption={`ring = time elapsed vs. ${data.alerts[0]?.slaMinutes ?? 30}-min SLA`} action={<AlertTriangle className="h-4 w-4 text-severity-critical" aria-hidden="true" />} />
                {data.alerts.length === 0 ? (
                  <p className="mt-3 text-xs text-severity-low">No urgent safety alerts at the moment.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {data.alerts.map((alert) => (
                      <li key={alert.id} className={cn("flex items-center gap-3 rounded-md border px-3 py-2", riskClasses(alert.severity).soft, riskClasses(alert.severity).border)}>
                        <ConfidenceRing
                          value={alert.slaPercent}
                          size={34}
                          title={`Time elapsed vs. SLA for ${alert.patientName}`}
                          color={alert.slaPercent != null && alert.slaPercent >= 80 ? riskClasses("Critical").cssVar : riskClasses(alert.severity).cssVar}
                          label={alert.elapsedMinutes != null ? formatMinutes(alert.elapsedMinutes) : "–"}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-ink-900">{alert.patientName}</p>
                          <p className="truncate text-2xs text-ink-700">{alert.detail || alert.label}</p>
                        </div>
                        <SeverityChip level={alert.severity} variant="solid" label="Escalate" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="card-surface p-5">
                <CardHeading
                  title="AI Insight"
                  action={
                    <span className="inline-flex items-center gap-1 rounded-pill bg-accent-050 px-2 py-0.5 text-2xs font-semibold text-accent-700">
                      <Lightbulb className="h-3 w-3" aria-hidden="true" />
                      {data.insight.basis ?? `${data.insight.confidence}% confidence`}
                    </span>
                  }
                />
                <p className="mt-3 text-xs font-semibold text-ink-900">{data.insight.title}</p>
                <p className="mt-1 text-2xs leading-relaxed text-ink-500">{data.insight.summary}</p>
              </div>

              <DisclaimerBar />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
