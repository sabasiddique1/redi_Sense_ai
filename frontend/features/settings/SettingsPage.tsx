"use client";

import { PageHeader } from "../shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function SettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings & Integrations"
        subtitle="Model selection, voice, API keys, EHR/FHIR integration, and audit log."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#101828]">
              AI model selection
            </CardTitle>
            <p className="text-[11px] text-[#667085]">
              Choose the reasoning model for report analysis and triage.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <select className="h-10 w-full rounded-[14px] border border-[#E6ECF5] bg-white px-3 text-sm text-[#101828]">
              <option>OpenAI GPT-4o (default)</option>
              <option>OpenAI o1</option>
              <option>Claude 3.5 Sonnet</option>
            </select>
          </CardContent>
        </Card>

        <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#101828]">
              Voice input / output
            </CardTitle>
            <p className="text-[11px] text-[#667085]">
              Enable voice for copilot and dictation.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between rounded-[14px] bg-[#F8FAFD] px-3 py-2">
              <span className="text-xs text-[#101828]">Voice toggle</span>
              <Badge tone="outline">Coming soon</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)] lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#101828]">
              API keys
            </CardTitle>
            <p className="text-[11px] text-[#667085]">
              Placeholders for OpenAI, embeddings, and other providers.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div>
              <label className="text-[11px] text-[#667085]">OpenAI API key</label>
              <Input
                type="password"
                placeholder="sk-..."
                className="mt-1 rounded-[14px]"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#667085]">Embeddings provider</label>
              <Input
                type="password"
                placeholder="Placeholder"
                className="mt-1 rounded-[14px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)] lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#101828]">
              EHR / FHIR integration
            </CardTitle>
            <p className="text-[11px] text-[#667085]">
              Connect to Epic, Cerner, or FHIR-compliant systems.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              <div className="rounded-[14px] border border-dashed border-[#E6ECF5] bg-[#F8FAFD] px-4 py-3">
                <p className="text-xs font-medium text-[#667085]">Epic</p>
                <p className="text-[11px] text-[#98A2B3]">Placeholder</p>
              </div>
              <div className="rounded-[14px] border border-dashed border-[#E6ECF5] bg-[#F8FAFD] px-4 py-3">
                <p className="text-xs font-medium text-[#667085]">Cerner</p>
                <p className="text-[11px] text-[#98A2B3]">Placeholder</p>
              </div>
              <div className="rounded-[14px] border border-dashed border-[#E6ECF5] bg-[#F8FAFD] px-4 py-3">
                <p className="text-xs font-medium text-[#667085]">FHIR endpoint</p>
                <p className="text-[11px] text-[#98A2B3]">Placeholder</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)] lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#101828]">
              Audit log
            </CardTitle>
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
