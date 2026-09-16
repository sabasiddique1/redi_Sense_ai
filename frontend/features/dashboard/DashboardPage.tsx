"use client";

import { useCallback, useEffect, useState } from "react";

import { useAppState } from "@/hooks/useAppState";
import { ApiError, apiClient } from "@/lib/api";
import type { ResultMode } from "@/lib/contracts";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "../shared/PageHeader";
import { MetricCard } from "../shared/MetricCard";
import { ReportsTable } from "../shared/ReportsTable";
import { AlertCard } from "../shared/AlertCard";
import { InsightCard } from "../shared/InsightCard";
import { RiskDistributionChart } from "../shared/RiskDistributionChart";
import { RecentActivityPanel } from "../shared/RecentActivityPanel";
import { ErrorState, SkeletonCard } from "../shared/PageStates";
import { buildDemoDashboardSummary } from "../mock-data/dashboard";
import { mapDashboardSummary, type DashboardViewData } from "./view-model";

function modeLabel(mode: ResultMode): string {
  if (mode === "real") return "Connected";
  if (mode === "fallback") return "Connected fallback";
  if (mode === "demo") return "Demo";
  return "Error";
}

function modeTone(mode: ResultMode): "success" | "warning" | "outline" | "danger" {
  if (mode === "real") return "success";
  if (mode === "fallback") return "warning";
  if (mode === "demo") return "outline";
  return "danger";
}

function greetingForHour(hour: number): string {
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

function DashboardSkeleton() {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} lines={2} />
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          <SkeletonCard lines={5} />
          <SkeletonCard lines={3} />
        </div>
        <div className="space-y-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      </section>
    </>
  );
}

export function DashboardPage() {
  const { demoMode, activityVersion, user, hydrated } = useAppState();
  // Data is always populated in the effect so server and client render the
  // same initial markup regardless of the persisted demo toggle.
  const [data, setData] = useState<DashboardViewData | null>(null);
  const [mode, setMode] = useState<ResultMode>("real");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("Welcome");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const result = await apiClient.fetchDashboardSummary({
          demoMode,
          fallback: buildDemoDashboardSummary,
          fallbackMessage: "Demo mode is enabled. Showing the demo dashboard snapshot.",
        });
        if (cancelled) {
          return;
        }
        setData(mapDashboardSummary(result.data));
        setMode(result.mode);
        setError(result.warning ?? null);
      } catch (caughtError) {
        if (cancelled) {
          return;
        }
        const message =
          caughtError instanceof ApiError
            ? caughtError.message
            : "Unable to load the connected dashboard summary.";
        setData(null);
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
  }, [demoMode, activityVersion, reloadKey, hydrated]);

  const showSkeleton = loading && !data;
  const showError = !loading && !data && mode === "error";

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${greeting}, ${user.name}`}
        subtitle="Here’s a snapshot of today’s report risk, triage queue, and key AI findings."
      />

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
        <Badge tone={modeTone(mode)}>{modeLabel(mode)}</Badge>
        {loading && data ? <span>Refreshing…</span> : null}
        {error && mode !== "error" ? <span>{error}</span> : null}
      </div>

      {showSkeleton ? <DashboardSkeleton /> : null}

      {showError ? (
        <ErrorState
          title="The connected dashboard is unavailable"
          description={
            error ??
            "Restore the backend service or enable demo mode explicitly from Settings."
          }
          onRetry={retry}
        />
      ) : null}

      {data ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.metrics.map((m) => (
              <MetricCard key={m.id} metric={m} />
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
            <div className="space-y-4">
              <ReportsTable reports={data.reportsQueue} />
              <RecentActivityPanel items={data.recentActivity} />
            </div>
            <div className="space-y-4">
              <RiskDistributionChart
                distribution={data.riskDistribution}
                title={
                  mode === "demo"
                    ? "Risk distribution (last 24h)"
                    : `Risk distribution (last ${data.riskWindowDays} days)`
                }
                description={
                  mode === "demo"
                    ? "Compact stacked bar summarizing triage risk across all incoming reports."
                    : "Persisted triage sessions grouped by rule-based risk level."
                }
              />
              <AlertCard alerts={data.urgentAlerts} />
              <InsightCard insight={data.aiInsight} />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
