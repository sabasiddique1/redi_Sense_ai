"use client";

import { useEffect, useState } from "react";
import { Cpu, Palette, Plug, ShieldCheck } from "lucide-react";

import { ConfidenceRing } from "@/components/charts/ConfidenceRing";
import { DonutChart, DonutChartEmpty } from "@/components/charts/DonutChart";
import { Sparkline, SparklineEmpty } from "@/components/charts/Sparkline";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useTheme, type ThemePreference } from "@/components/providers/ThemeProvider";
import { useAppState } from "@/hooks/useAppState";
import { PageHeader } from "../shared/PageHeader";

type ConfigRow = { key: string; value: string; note?: string };

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const APP_VERSION = "0.1.0";
const LATENCY_SAMPLES = 8;

export function SettingsPage() {
  const { apiBaseUrl, demoMode, publicConfig, setDemoMode, hydrated } = useAppState();
  const { preference, setTheme } = useTheme();
  const [latency, setLatency] = useState<number[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);

  // Client-measured latency to /health; the backend keeps no latency history.
  useEffect(() => {
    if (!hydrated || demoMode) return;
    let cancelled = false;
    const probe = async () => {
      setChecking(true);
      const samples: number[] = [];
      for (let i = 0; i < 3; i += 1) {
        const started = performance.now();
        try {
          const response = await fetch(`${apiBaseUrl}/health`, { cache: "no-store" });
          if (!response.ok) throw new Error(String(response.status));
          samples.push(Math.round(performance.now() - started));
        } catch {
          break;
        }
      }
      if (cancelled) return;
      setLatency((current) => [...current, ...samples].slice(-LATENCY_SAMPLES));
      if (samples.length > 0) setLastSync(new Date());
      setChecking(false);
    };
    void probe();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, demoMode, hydrated]);

  const configRows: ConfigRow[] = publicConfig
    ? [
        { key: "Chat model", value: publicConfig.openai_chat_model },
        { key: "Embedding model", value: publicConfig.openai_embedding_model },
        { key: "Auth mode", value: publicConfig.auth_enabled ? "Auth0 bearer tokens" : "Dev bypass" },
        { key: "Backend demo fallback", value: publicConfig.demo_mode_enabled ? "Enabled" : "Disabled" },
        // TODO(backend): expose chunk size / overlap and minimum citation confidence on /api/system/config.
        { key: "Chunk size / overlap", value: "Not exposed", note: "server-side setting" },
        { key: "Minimum citation confidence", value: "Not exposed", note: "server-side setting" },
      ]
    : [];

  const columns: DataTableColumn<ConfigRow>[] = [
    { id: "key", header: "Setting", cell: (row) => <span className="font-medium text-ink-900">{row.key}</span>, width: "40%" },
    { id: "value", header: "Value", mono: true, cell: (row) => (
        <span>
          {row.value}
          {row.note ? <span className="ml-2 font-sans text-2xs text-ink-400">{row.note}</span> : null}
        </span>
      ) },
  ];

  const latestLatency = latency[latency.length - 1];
  const syncedAgo = lastSync ? Math.max(0, Math.round((Date.now() - lastSync.getTime()) / 1000)) : null;

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Connection, model configuration, appearance, and data handling." />

      <section className="card-surface p-5" aria-labelledby="settings-connection">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="settings-connection" className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Plug className="h-4 w-4 text-accent-600" aria-hidden="true" />
              Connection
            </h2>
            <p className="mt-0.5 text-2xs text-ink-500">Connected mode reads live records from the FastAPI backend; demo mode uses curated sample data.</p>
          </div>
          <div className="flex items-center gap-5">
            <div className="w-[120px]">
              <p className="text-2xs text-ink-500">
                Latency <span className="font-mono text-ink-700 rs-tabular">{latestLatency != null ? `${latestLatency}ms` : "—"}</span>
              </p>
              <div className="mt-1 h-6">{latency.length >= 2 ? <Sparkline values={latency} height={24} title="Health-check latency, recent probes" /> : <SparklineEmpty height={24} message={demoMode ? "Demo mode" : "Measuring…"} />}</div>
            </div>
            <div className="flex items-center gap-2 text-2xs text-ink-500">
              <ConfidenceRing value={lastSync ? 100 : null} size={34} state={checking ? "loading" : demoMode || lastSync ? "default" : "error"} title="Backend sync" label={lastSync ? "✓" : "–"} />
              <span>{demoMode ? "Demo, no sync" : lastSync ? `Synced ${syncedAgo}s ago` : "Not reachable"}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr]">
          <div className="rounded-md bg-surface-sunken px-4 py-3">
            <p className="text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">Mode</p>
            <div className="mt-2">
              <ToggleSwitch checked={!demoMode} onChange={(connected) => setDemoMode(!connected)} label="Connected mode" labels={["Demo", "Connected"]} />
            </div>
            <p className="mt-2 text-2xs text-ink-500">Demo uses synthetic patients; Connected reads live records and never falls back to demo data on error.</p>
          </div>
          <div className="rounded-md bg-surface-sunken px-4 py-3">
            <p className="text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">API base URL</p>
            <p className="mt-2 font-mono text-xs text-ink-900">{apiBaseUrl}</p>
            <p className="mt-2 text-2xs text-ink-500">Set NEXT_PUBLIC_API_BASE_URL to change it. Secrets stay on the backend.</p>
          </div>
        </div>
      </section>

      <section className="card-surface p-5" aria-labelledby="settings-model">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <h2 id="settings-model" className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Cpu className="h-4 w-4 text-accent-600" aria-hidden="true" />
              Model &amp; RAG configuration
            </h2>
            <p className="mt-0.5 text-2xs text-ink-500">Read-only · from /api/system/config</p>
            <div className="mt-3">
              <DataTable caption="Runtime configuration" columns={columns} rows={configRows} rowKey={(row) => row.key} zebra emptyMessage={demoMode ? "Demo mode: configuration is read from the backend in connected mode." : "Backend configuration unavailable."} />
            </div>
          </div>
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.04em] text-ink-500">Retrieval mix</p>
            <p className="text-2xs text-ink-400">lexical vs. vector</p>
            <div className="mt-2">
              {demoMode ? (
                <DonutChart segments={[{ label: "Vector", value: 65, color: "var(--rs-data-2)" }, { label: "Lexical", value: 35, color: "var(--rs-data-2)", opacity: 0.35 }]} centerValue="65%" size={100} strokeWidth={12} title="Retrieval mix" />
              ) : (
                // TODO(backend): per-query retrieval mode counts are only in rag_trace; no aggregate endpoint exists.
                <DonutChartEmpty size={100} message="Not available — needs retrieval statistics" />
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="card-surface p-5" aria-labelledby="settings-appearance">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="settings-appearance" className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Palette className="h-4 w-4 text-accent-600" aria-hidden="true" />
              Appearance
            </h2>
            <p className="mt-0.5 text-2xs text-ink-500">System follows your OS preference. The choice is saved on this device.</p>
          </div>
          <SegmentedControl label="Theme" value={preference} onChange={setTheme} options={THEME_OPTIONS} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-surface p-5" aria-labelledby="settings-retention">
          <h2 id="settings-retention" className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <ShieldCheck className="h-4 w-4 text-accent-600" aria-hidden="true" />
            Data retention
          </h2>
          {/* TODO(backend): retention policy is not configurable yet; these rows describe current behaviour. */}
          <dl className="mt-3 divide-y divide-border-hairline text-xs">
            <div className="flex justify-between py-2"><dt className="text-ink-700">Copilot conversations</dt><dd className="text-ink-900">Kept until deleted</dd></div>
            <div className="flex justify-between py-2"><dt className="text-ink-700">Uploaded reports</dt><dd className="text-ink-900">Text stored; files not retained</dd></div>
            <div className="flex justify-between py-2"><dt className="text-ink-700">Audit log</dt><dd className="text-ink-900">Request ids in server logs only</dd></div>
          </dl>
        </section>
        <section className="card-surface p-5" aria-labelledby="settings-about">
          <h2 id="settings-about" className="text-sm font-semibold text-ink-900">About</h2>
          <dl className="mt-3 divide-y divide-border-hairline text-xs">
            <div className="flex justify-between py-2"><dt className="text-ink-700">Version</dt><dd className="font-mono text-ink-900">{APP_VERSION}</dd></div>
            <div className="flex justify-between py-2"><dt className="text-ink-700">Deployment</dt><dd className="text-ink-900">Local · FastAPI + Postgres/pgvector</dd></div>
            <div className="flex justify-between py-2"><dt className="text-ink-700">EHR / FHIR</dt><dd className="text-ink-400">Coming soon</dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}
