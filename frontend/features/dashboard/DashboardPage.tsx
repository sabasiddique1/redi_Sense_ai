"use client";

import { useEffect, useState } from "react";

import { useAppState } from "@/hooks/useAppState";
import { ApiError, apiClient } from "@/lib/api";
import type { ResultMode } from "@/lib/contracts";
import { PageHeader } from "../shared/PageHeader";
import { MetricCard } from "../shared/MetricCard";
import { ReportsTable } from "../shared/ReportsTable";
import { AlertCard } from "../shared/AlertCard";
import { InsightCard } from "../shared/InsightCard";
import { RiskDistributionChart } from "../shared/RiskDistributionChart";
import { RecentActivityPanel } from "../shared/RecentActivityPanel";
import { buildDemoDashboardSummary } from "../mock-data/dashboard";
import { mapDashboardSummary, type DashboardViewData } from "./view-model";

function modeLabel(mode: ResultMode): string {
  if (mode === "real") return "Connected";
  if (mode === "fallback") return "Connected fallback";
  if (mode === "demo") return "Demo";
  return "Error";
}

export function DashboardPage() {
  const { demoMode, activityVersion } = useAppState();
  // Data is always populated in the effect so server and client render the
  // same initial markup regardless of the persisted demo toggle.
  const [data, setData] = useState<DashboardViewData | null>(null);
  const [mode, setMode] = useState<ResultMode>("real");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [demoMode, activityVersion]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Morning, Dr. Hernandez"
        subtitle="Here’s a snapshot of today’s report risk, triage queue, and key AI findings."
      />

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#667085]">
        <span className="rounded-full border border-[#E6ECF5] bg-white px-2.5 py-1 font-medium">
          {modeLabel(mode)}
        </span>
        {loading && <span>Loading dashboard summary…</span>}
        {error && (
          <span className={mode === "error" ? "text-[#B42318]" : undefined}>{error}</span>
        )}
      </div>

      {data && (
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
              <RiskDistributionChart distribution={data.riskDistribution} />
              <AlertCard alerts={data.urgentAlerts} />
              <InsightCard insight={data.aiInsight} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
