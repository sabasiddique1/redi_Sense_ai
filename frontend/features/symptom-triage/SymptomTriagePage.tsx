"use client";

import { useState } from "react";
import { PageHeader } from "../shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { mockTriageResult } from "../mock-data/symptom-triage";

export function SymptomTriagePage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<typeof mockTriageResult | null>(null);

  const handleAnalyze = () => {
    setResult(mockTriageResult);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Symptom Triage"
        subtitle="Describe symptoms for AI-powered triage, red-flag detection, and recommended actions."
      />

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left: Input */}
        <div className="lg:col-span-5">
          <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#101828]">
                Symptom input
              </CardTitle>
              <p className="text-[11px] text-[#667085]">
                Describe chief complaint, duration, severity, and any red flags.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <Textarea
                placeholder="e.g., 62yo M, chest tightness x 2 hours, radiating to left arm, diaphoresis, no prior cardiac history..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={6}
                className="rounded-[14px] border-[#E6ECF5]"
              />
              <Button onClick={handleAnalyze} className="w-full">
                Analyze triage
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Results */}
        <div className="space-y-4 lg:col-span-7">
          {result ? (
            <>
              <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-semibold text-[#101828]">
                    Triage result
                  </CardTitle>
                  <Badge
                    tone={
                      ["High", "Critical"].includes(result.riskLevel)
                        ? "danger"
                        : ["Moderate"].includes(result.riskLevel)
                        ? "warning"
                        : "success"
                    }
                  >
                    {result.riskLevel}
                  </Badge>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs leading-relaxed text-[#101828]">
                    {result.summary}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.differential.map((d) => (
                      <span
                        key={d}
                        className="rounded-full bg-[#EAF2FF] px-2.5 py-0.5 text-[11px] font-medium text-[#1D4ED8]"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[20px] border border-[#FEE2E2] bg-[#FEF2F2] shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-[#B91C1C]">
                    Red flags detected
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {result.redFlags.map((f) => (
                    <div
                      key={f}
                      className="flex items-center gap-2 rounded-[14px] bg-white/80 px-3 py-2"
                    >
                      <span className="text-red-500">⚠</span>
                      <p className="text-xs text-[#7F1D1D]">{f}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-[#101828]">
                    Recommended action
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="rounded-[14px] bg-[#EAF2FF] p-4">
                    <p className="text-sm font-semibold text-[#1D4ED8]">
                      {result.recommendedAction}
                    </p>
                    <p className="mt-1 text-xs text-[#667085]">
                      {result.actionDetail}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="rounded-[20px] border border-[#E6ECF5] bg-white p-12 text-center shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
              <p className="text-sm text-[#98A2B3]">
                Enter symptoms and click &quot;Analyze triage&quot; to see results.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
