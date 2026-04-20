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
        <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[#4C8DFF]" />
              <CardTitle className="text-sm font-semibold text-[#101828]">
                AI model selection
              </CardTitle>
            </div>
            <p className="text-[11px] text-[#667085]">
              Connected-mode runtime configuration from the backend.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="rounded-[14px] bg-[#F8FAFD] px-4 py-3">
              <p className="text-[11px] text-[#667085]">Chat model</p>
              <p className="text-sm font-medium text-[#101828]">
                {publicConfig?.openai_chat_model ?? "Unavailable"}
              </p>
            </div>
            <div className="rounded-[14px] bg-[#F8FAFD] px-4 py-3">
              <p className="text-[11px] text-[#667085]">Embedding model</p>
              <p className="text-sm font-medium text-[#101828]">
                {publicConfig?.openai_embedding_model ?? "Unavailable"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-[#4C8DFF]" />
              <CardTitle className="text-sm font-semibold text-[#101828]">
                Voice input / output
              </CardTitle>
            </div>
            <p className="text-[11px] text-[#667085]">
              Explicit connected versus demo behavior for local development.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="flex items-center justify-between rounded-[14px] bg-[#F8FAFD] px-4 py-3">
              <span className="text-sm font-medium text-[#101828]">
                {demoMode ? "Demo mode enabled" : "Connected mode preferred"}
              </span>
              <Badge tone={demoMode ? "warning" : "success"}>
                {demoMode ? "Demo" : "Connected"}
              </Badge>
            </div>
            <Button variant="outline" onClick={() => setDemoMode(!demoMode)}>
              {demoMode ? "Switch to connected mode" : "Switch to demo mode"}
            </Button>
            <p className="text-[11px] text-[#667085]">
              Connected mode now shows truthful service errors. Demo content appears only when demo mode is enabled explicitly.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)] lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-[#4C8DFF]" />
              <CardTitle className="text-sm font-semibold text-[#101828]">
                Connection details
              </CardTitle>
            </div>
            <p className="text-[11px] text-[#667085]">
              Non-secret runtime information only. Secret keys stay on the backend.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 pt-0 sm:grid-cols-2">
            <div className="rounded-[14px] bg-[#F8FAFD] px-4 py-3">
              <p className="text-[11px] text-[#667085]">API base URL</p>
              <p className="text-sm font-medium text-[#101828]">{apiBaseUrl}</p>
            </div>
            <div className="rounded-[14px] bg-[#F8FAFD] px-4 py-3">
              <p className="text-[11px] text-[#667085]">Auth mode</p>
              <p className="text-sm font-medium text-[#101828]">
                {publicConfig?.auth_enabled ? "Auth0 enabled" : "Dev bypass"}
              </p>
            </div>
            <div className="rounded-[14px] bg-[#F8FAFD] px-4 py-3">
              <p className="text-[11px] text-[#667085]">Backend demo fallback</p>
              <p className="text-sm font-medium text-[#101828]">
                {publicConfig?.demo_mode_enabled ? "Enabled" : "Disabled"}
              </p>
            </div>
            <div className="rounded-[14px] bg-[#F8FAFD] px-4 py-3">
              <p className="text-[11px] text-[#667085]">Secret key handling</p>
              <p className="text-sm font-medium text-[#101828]">
                Managed server-side only
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)] lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#4C8DFF]" />
              <CardTitle className="text-sm font-semibold text-[#101828]">
                EHR / FHIR integration
              </CardTitle>
            </div>
            <p className="text-[11px] text-[#667085]">
              Connect to Epic, Cerner, or FHIR-compliant systems.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              <div className="rounded-[14px] border border-dashed border-[#E6ECF5] bg-[#F8FAFD] px-4 py-3">
                <p className="text-xs font-medium text-[#667085]">Epic</p>
                <p className="text-[11px] text-[#98A2B3]">Coming soon</p>
              </div>
              <div className="rounded-[14px] border border-dashed border-[#E6ECF5] bg-[#F8FAFD] px-4 py-3">
                <p className="text-xs font-medium text-[#667085]">Cerner</p>
                <p className="text-[11px] text-[#98A2B3]">Coming soon</p>
              </div>
              <div className="rounded-[14px] border border-dashed border-[#E6ECF5] bg-[#F8FAFD] px-4 py-3">
                <p className="text-xs font-medium text-[#667085]">FHIR endpoint</p>
                <p className="text-[11px] text-[#98A2B3]">Coming soon</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)] lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#4C8DFF]" />
              <CardTitle className="text-sm font-semibold text-[#101828]">
                Audit log
              </CardTitle>
            </div>
            <p className="text-[11px] text-[#667085]">
              View access and usage history.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-[14px] bg-[#F8FAFD] p-4">
              <p className="text-xs text-[#98A2B3]">
                Audit log placeholder — will show report views, triage runs, and API calls.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
