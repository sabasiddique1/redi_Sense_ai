"use client";

import { useState } from "react";
import { PageHeader } from "../shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockReportAnalysis } from "../mock-data/report-analyzer";

export function ReportAnalyzerPage() {
  const [activeTab, setActiveTab] = useState("summary");
  const data = mockReportAnalysis;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Report Analyzer"
        subtitle="Upload medical reports for AI-powered classification, extraction, and evidence-backed guidance."
      />

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left: Upload + Preview */}
        <div className="space-y-4 lg:col-span-4">
          <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#101828]">
                Upload report
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex min-h-[140px] flex-col items-center justify-center rounded-[14px] border-2 border-dashed border-[#E6ECF5] bg-[#F8FAFD] p-4 text-center">
                <span className="mb-2 text-2xl">📄</span>
                <p className="text-xs font-medium text-[#667085]">
                  Drag & drop or click to upload
                </p>
                <p className="mt-0.5 text-[11px] text-[#98A2B3]">
                  PDF, DICOM, DOCX up to 10MB
                </p>
                <Button variant="outline" size="sm" className="mt-4">
                  Choose file
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#101828]">
                Report preview
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-h-48 overflow-y-auto rounded-[14px] bg-[#F8FAFD] p-3 text-[11px] leading-relaxed text-[#667085]">
                {data.reportPreview}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center: AI Analysis */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-[#101828]">
                AI analysis result
              </CardTitle>
              <Badge className="bg-[#EAF2FF] text-[11px] text-[#1D4ED8]">
                {data.confidence}% confidence
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div>
                <p className="text-[11px] font-medium text-[#667085]">
                  Predicted category
                </p>
                <p className="mt-0.5 text-sm font-semibold text-[#101828]">
                  {data.category}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-[#667085]">
                  Plain-language summary
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#101828]">
                  {data.plainLanguageSummary}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-[#667085]">
                  Top keywords
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {data.topKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-full bg-[#EAF2FF] px-2.5 py-0.5 text-[11px] font-medium text-[#1D4ED8]"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-medium text-[#667085]">
                  Extracted findings
                </p>
                <ul className="mt-1.5 space-y-1 text-[11px] text-[#101828]">
                  {data.findings.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4C8DFF]" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="inline-flex items-center gap-1 rounded-full bg-[#F2F4F7] p-1">
              {(["summary", "structured", "evidence", "history"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-[#111111] text-white"
                      : "text-[#667085] hover:text-[#101828]"
                  }`}
                >
                  {tab === "structured" ? "Structured Data" : tab === "summary" ? "Summary" : tab === "evidence" ? "Evidence" : "History"}
                </button>
              ))}
            </div>
            <Card className="rounded-[20px] border border-[#E6ECF5] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
              {activeTab === "summary" && (
                <p className="text-xs leading-relaxed text-[#667085]">
                  {data.category} — {data.plainLanguageSummary}
                </p>
              )}
              {activeTab === "structured" && (
                <pre className="overflow-x-auto text-[11px] text-[#667085]">
                  {JSON.stringify(data.structuredData, null, 2)}
                </pre>
              )}
              {activeTab === "evidence" && (
                <p className="text-xs text-[#667085]">
                  Cited evidence and guidelines will appear here.
                </p>
              )}
              {activeTab === "history" && (
                <p className="text-xs text-[#667085]">
                  Previous analyses for this session.
                </p>
              )}
            </Card>
          </div>
        </div>

        {/* Right: Urgency + Next steps + Evidence */}
        <div className="space-y-4 lg:col-span-3">
          <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#101828]">
                Urgency
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Badge
                tone={data.urgency === "High" ? "danger" : "warning"}
                className="text-xs"
              >
                {data.urgency}
              </Badge>
            </CardContent>
          </Card>

          <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#101828]">
                Suggested next steps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {data.suggestedNextSteps.map((s) => (
                <div
                  key={s}
                  className="flex items-start gap-2 rounded-[14px] bg-[#F8FAFD] px-3 py-2"
                >
                  <span className="text-[18px]">✓</span>
                  <p className="text-xs text-[#101828]">{s}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#101828]">
                Cited evidence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {data.citedEvidence.map((e) => (
                <div
                  key={e.id}
                  className="rounded-[14px] border border-[#E6ECF5] bg-[#F8FAFD] px-3 py-2"
                >
                  <p className="text-xs font-medium text-[#101828]">{e.title}</p>
                  <p className="mt-0.5 text-[11px] text-[#667085]">{e.source}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
