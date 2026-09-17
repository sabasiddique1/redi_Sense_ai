"use client";

import { Button } from "@/components/ui/button";
import { PageHeader } from "../shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Cpu, FileText, Mic } from "lucide-react";
import { useAppState } from "@/hooks/useAppState";

export function SettingsPage() {
  const { apiBaseUrl, demoMode, publicConfig, setDemoMode } = useAppState();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings & Integrations"
        subtitle="Model selection, voice, API keys, EHR/FHIR integration, and audit log."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-[20px] border border-border-subtle bg-surface shadow-soft">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold text-text-primary">
                AI model selection
              </CardTitle>
            </div>
            <p className="text-[11px] text-text-secondary">
              Connected-mode runtime configuration from the backend.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="rounded-[14px] bg-surface-muted px-4 py-3">
              <p className="text-[11px] text-text-secondary">Chat model</p>
              <p className="text-sm font-medium text-text-primary">
                {publicConfig?.openai_chat_model ?? "Unavailable"}
              </p>
            </div>
            <div className="rounded-[14px] bg-surface-muted px-4 py-3">
              <p className="text-[11px] text-text-secondary">Embedding model</p>
              <p className="text-sm font-medium text-text-primary">
                {publicConfig?.openai_embedding_model ?? "Unavailable"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[20px] border border-border-subtle bg-surface shadow-soft">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold text-text-primary">
                Voice input / output
              </CardTitle>
            </div>
            <p className="text-[11px] text-text-secondary">
              Explicit connected versus demo behavior for local development.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="flex items-center justify-between rounded-[14px] bg-surface-muted px-4 py-3">
              <span className="text-sm font-medium text-text-primary">
                {demoMode ? "Demo mode enabled" : "Connected mode preferred"}
              </span>
              <Badge tone={demoMode ? "warning" : "success"}>
                {demoMode ? "Demo" : "Connected"}
              </Badge>
            </div>
            <Button variant="outline" onClick={() => setDemoMode(!demoMode)}>
              {demoMode ? "Switch to connected mode" : "Switch to demo mode"}
            </Button>
            <p className="text-[11px] text-text-secondary">
              Connected mode now shows truthful service errors. Demo content appears only when demo mode is enabled explicitly.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-[20px] border border-border-subtle bg-surface shadow-soft lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold text-text-primary">
                Connection details
              </CardTitle>
            </div>
            <p className="text-[11px] text-text-secondary">
              Non-secret runtime information only. Secret keys stay on the backend.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 pt-0 sm:grid-cols-2">
            <div className="rounded-[14px] bg-surface-muted px-4 py-3">
              <p className="text-[11px] text-text-secondary">API base URL</p>
              <p className="text-sm font-medium text-text-primary">{apiBaseUrl}</p>
            </div>
            <div className="rounded-[14px] bg-surface-muted px-4 py-3">
              <p className="text-[11px] text-text-secondary">Auth mode</p>
              <p className="text-sm font-medium text-text-primary">
                {publicConfig?.auth_enabled ? "Auth0 enabled" : "Dev bypass"}
              </p>
            </div>
            <div className="rounded-[14px] bg-surface-muted px-4 py-3">
              <p className="text-[11px] text-text-secondary">Backend demo fallback</p>
              <p className="text-sm font-medium text-text-primary">
                {publicConfig?.demo_mode_enabled ? "Enabled" : "Disabled"}
              </p>
            </div>
            <div className="rounded-[14px] bg-surface-muted px-4 py-3">
              <p className="text-[11px] text-text-secondary">Secret key handling</p>
              <p className="text-sm font-medium text-text-primary">
                Managed server-side only
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[20px] border border-border-subtle bg-surface shadow-soft lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold text-text-primary">
                EHR / FHIR integration
              </CardTitle>
            </div>
            <p className="text-[11px] text-text-secondary">
              Connect to Epic, Cerner, or FHIR-compliant systems.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              <div className="rounded-[14px] border border-dashed border-border-subtle bg-surface-muted px-4 py-3">
                <p className="text-xs font-medium text-text-secondary">Epic</p>
                <p className="text-[11px] text-text-tertiary">Coming soon</p>
              </div>
              <div className="rounded-[14px] border border-dashed border-border-subtle bg-surface-muted px-4 py-3">
                <p className="text-xs font-medium text-text-secondary">Cerner</p>
                <p className="text-[11px] text-text-tertiary">Coming soon</p>
              </div>
              <div className="rounded-[14px] border border-dashed border-border-subtle bg-surface-muted px-4 py-3">
                <p className="text-xs font-medium text-text-secondary">FHIR endpoint</p>
                <p className="text-[11px] text-text-tertiary">Coming soon</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[20px] border border-border-subtle bg-surface shadow-soft lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold text-text-primary">
                Audit log
              </CardTitle>
            </div>
            <p className="text-[11px] text-text-secondary">
              View access and usage history.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-[14px] bg-surface-muted p-4">
              <p className="text-xs text-text-tertiary">
                Audit log placeholder — will show report views, triage runs, and API calls.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
