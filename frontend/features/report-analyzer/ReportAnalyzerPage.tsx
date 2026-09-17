"use client";

import { useRef, useState } from "react";
import { PageHeader } from "../shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  Sparkles,
  AlertCircle,
  ListChecks,
  BookOpen,
} from "lucide-react";
import { mockReportAnalysis } from "../mock-data/report-analyzer";
import { apiClient, ApiError } from "@/lib/api";
import type {
  AiMode,
  FallbackReason,
  ReportUploadResponse,
  ResultMode,
} from "@/lib/contracts";
import { useAppState } from "@/hooks/useAppState";
import { EmptyState, ErrorState, SkeletonCard } from "../shared/PageStates";
import { EvidenceChips, VerdictBlock } from "../shared/VerdictBlock";
import { isEscalationLevel, riskClasses, type RiskLevel } from "../shared/risk";

type ReportAnalysisView = {
  reportPreview: string;
  category: string;
  confidence: number | null;
  plainLanguageSummary: string;
  topKeywords: string[];
  findings: string[];
  urgency: RiskLevel;
  suggestedNextSteps: string[];
  safetyFlags: string[];
  fallbackReason: FallbackReason | null;
  citedEvidence: Array<{ id: string; title: string; source: string }>;
  structuredData: Record<string, unknown>;
  renderMode: ResultMode;
  aiMode: AiMode;
  disclaimer: string;
  uploadedFilename?: string | null;
  timelineEventId: number | null;
};

function buildDemoUploadResponse(
  filename: string,
  patientId: number | null,
): ReportUploadResponse {
  return {
    report_id: 0,
    patient_id: patientId,
    classification: mockReportAnalysis.category,
    key_findings: mockReportAnalysis.findings,
    summary: mockReportAnalysis.plainLanguageSummary,
    predicted_category: mockReportAnalysis.category,
    plain_language_summary: mockReportAnalysis.plainLanguageSummary,
    top_keywords: mockReportAnalysis.topKeywords,
    extracted_findings: mockReportAnalysis.findings,
    follow_up_recommendations: mockReportAnalysis.suggestedNextSteps,
    safety_flags: ["follow_up_recommended", "suspicious_language_present"],
    structured_data: mockReportAnalysis.structuredData,
    disclaimer:
      "Clinical decision support only. Verify findings with licensed clinical judgment.",
    mode: "demo",
    ai_mode: null,
    fallback_reason: null,
    timeline_event_id: null,
    created_at: new Date().toISOString(),
    filename,
    mime_type: "application/pdf",
    text_preview: mockReportAnalysis.reportPreview,
  };
}

function extractKeywords(payload: ReportUploadResponse): string[] {
  if (payload.top_keywords && payload.top_keywords.length > 0) {
    return payload.top_keywords;
  }

  const values = [
    ...(payload.extracted_findings ?? payload.key_findings),
    payload.predicted_category ?? payload.classification,
    ...Object.values(payload.structured_data).map((value) => String(value)),
  ]
    .join(" ")
    .toLowerCase()
    .match(/[a-z0-9-]{4,}/g);

  if (!values) {
    return [];
  }

  const unique = Array.from(new Set(values));
  return unique.slice(0, 6);
}

function deriveUrgency(payload: ReportUploadResponse): RiskLevel {
  const safetyFlags = payload.safety_flags ?? [];
  const flagText = safetyFlags.join(" ").toLowerCase();
  if (/critical|emergen|immediate/.test(flagText)) {
    return "Critical";
  }
  if (safetyFlags.includes("urgent_review_language_present")) {
    return "High";
  }
  if (safetyFlags.includes("suspicious_language_present")) {
    return "High";
  }
  if ((payload.follow_up_recommendations ?? []).length > 0) {
    return "Moderate";
  }
  const joined = `${payload.predicted_category ?? payload.classification} ${payload.plain_language_summary ?? payload.summary}`.toLowerCase();
  if (
    joined.includes("malign") ||
    joined.includes("spicul") ||
    joined.includes("critical") ||
    joined.includes("enlarg")
  ) {
    return "High";
  }
  if (safetyFlags.length === 0 && (payload.extracted_findings ?? payload.key_findings).length === 0) {
    return "Low";
  }
  return "Moderate";
}

function buildNextSteps(payload: ReportUploadResponse): string[] {
  if (payload.follow_up_recommendations && payload.follow_up_recommendations.length > 0) {
    return payload.follow_up_recommendations;
  }

  const recommendation = payload.structured_data.recommendation;
  if (typeof recommendation === "string" && recommendation.trim()) {
    return recommendation
      .split(/,|;/)
      .map((step) => step.trim())
      .filter(Boolean);
  }

  return [
    "Review the extracted report content with the care team.",
    "Correlate the result with prior imaging and the original report text.",
    "Document follow-up actions in the patient timeline.",
  ];
}

function mapUploadToView(
  payload: ReportUploadResponse,
): ReportAnalysisView {
  return {
    reportPreview: payload.text_preview || "No text preview was returned for this report.",
    category: payload.predicted_category ?? payload.classification,
    confidence: payload.mode === "demo" ? mockReportAnalysis.confidence : null,
    plainLanguageSummary: payload.plain_language_summary ?? payload.summary,
    topKeywords: extractKeywords(payload),
    findings: payload.extracted_findings ?? payload.key_findings,
    urgency: deriveUrgency(payload),
    suggestedNextSteps: buildNextSteps(payload),
    safetyFlags: payload.safety_flags ?? [],
    fallbackReason: payload.fallback_reason ?? null,
    structuredData: payload.structured_data,
    citedEvidence: payload.mode === "demo" ? mockReportAnalysis.citedEvidence : [],
    renderMode: payload.mode,
    aiMode: payload.ai_mode,
    disclaimer: payload.disclaimer,
    uploadedFilename: payload.filename,
    timelineEventId: payload.timeline_event_id,
  };
}

function modeLabel(mode: ResultMode): string {
  if (mode === "real") return "Connected";
  if (mode === "fallback") return "Connected fallback";
  if (mode === "demo") return "Demo";
  return "Error";
}

export function ReportAnalyzerPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { demoMode, selectedPatient, selectedPatientId, notifyPatientActivity } = useAppState();
  const [activeTab, setActiveTab] = useState("summary");
  // Starts empty in both modes; the demo analysis is produced only when a file
  // is submitted while demo mode is on (via the fallback in handleFileChange).
  const [analysis, setAnalysis] = useState<ReportAnalysisView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [timelineMessage, setTimelineMessage] = useState<string | null>(null);

  const data = analysis;
  const evidenceChips =
    data && data.citedEvidence.length > 0
      ? data.citedEvidence.map((item) => ({ id: item.id, label: item.title, query: item.title }))
      : (data?.topKeywords ?? []).map((keyword) => ({ id: keyword, label: keyword, query: keyword }));
  const escalate =
    !!data &&
    (isEscalationLevel(data.urgency) ||
      /urgent|escalat|critical|immediate/.test(data.safetyFlags.join(" ").toLowerCase()));

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setLoading(true);
    setError(null);
    setUploadProgress(0);
    setTimelineMessage(null);
    try {
      const result = await apiClient.uploadReport(file, {
        patientId: selectedPatientId,
        demoMode,
        onProgress: setUploadProgress,
        fallback: () => buildDemoUploadResponse(file.name, selectedPatientId),
        fallbackMessage: "Demo mode is enabled. Showing demo analysis.",
      });

      setAnalysis(mapUploadToView(result.data));
      setUploadProgress(result.mode === "demo" ? 0 : 100);
      setError(result.warning ?? null);
      if (result.mode !== "demo" && result.data.timeline_event_id && selectedPatientId) {
        const message = "Report analysis saved and patient timeline updated.";
        setTimelineMessage(message);
        notifyPatientActivity(message, selectedPatientId);
      } else if (result.mode === "demo") {
        setTimelineMessage("Demo mode result only. No timeline event was created.");
      }
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiError ? caughtError.message : "Unable to upload and analyze the report right now.";
      setError(message);
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Report Analyzer"
        subtitle="Upload medical reports for AI-powered classification, extraction, and evidence-backed guidance."
      />

      {data ? (
        <div className="space-y-3">
          <VerdictBlock
            severityLabel="Urgency"
            severity={data.urgency}
            secondary={data.category}
            confidence={data.confidence}
            confidenceNote={
              data.confidence == null
                ? "The connected analysis does not score confidence."
                : "Demo score for the sample report."
            }
            escalate={escalate}
            escalationText={
              data.safetyFlags.length > 0
                ? `Safety flags: ${data.safetyFlags.join(", ")}`
                : "No safety flags were raised by the analyzer."
            }
            basis={data.aiMode ? `AI processing: ${data.aiMode}` : "Extraction-grounded analysis"}
            mode={data.renderMode}
          />
          <EvidenceChips
            title={data.citedEvidence.length > 0 ? "Cited evidence" : "Evidence lookups"}
            items={evidenceChips}
          />
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left: Upload + Preview */}
        <div className="space-y-4 lg:col-span-4">
          <Card className="rounded-[20px] border border-border-subtle bg-surface shadow-soft">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold text-text-primary">
                  Upload report
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex min-h-[140px] flex-col items-center justify-center rounded-[14px] border-2 border-dashed border-border-subtle bg-surface-muted p-4 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.docx,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Upload className="mb-2 h-10 w-10 text-text-tertiary" />
                <p className="text-xs font-medium text-text-secondary">
                  Drag & drop or click to upload
                </p>
                <p className="mt-0.5 text-[11px] text-text-tertiary">
                  PDF, TXT, MD, DOCX up to 10MB
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => fileInputRef.current?.click()}
                  loading={loading}
                >
                  {loading ? "Uploading…" : "Choose file"}
                </Button>
                <p className="mt-3 text-[11px] text-text-secondary">
                  {selectedPatient
                    ? `Linked patient: ${selectedPatient.name}`
                    : "No patient selected"}
                </p>
                {data?.uploadedFilename ? (
                  <p className="text-[11px] text-text-tertiary">
                    Last upload: {data.uploadedFilename}
                  </p>
                ) : null}
                {loading && uploadProgress > 0 ? (
                  <p className="text-[11px] text-primary">
                    Upload progress: {uploadProgress}%
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="flex max-h-[280px] flex-col rounded-[20px] border border-border-subtle bg-surface shadow-soft">
            <CardHeader className="shrink-0 pb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold text-text-primary">
                  Report preview
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-hidden pt-0">
              <div className="h-full max-h-[200px] overflow-y-auto rounded-[14px] bg-surface-muted p-3 text-[11px] leading-relaxed text-text-secondary">
                {data ? data.reportPreview : "The extracted report text will appear here after upload."}
              </div>
            </CardContent>
          </Card>
        </div>

        {loading && !data ? (
          <div className="space-y-4 lg:col-span-8" aria-busy="true">
            <SkeletonCard lines={5} />
            <div className="grid gap-4 md:grid-cols-2">
              <SkeletonCard lines={3} />
              <SkeletonCard lines={3} />
            </div>
          </div>
        ) : null}

        {!loading && !data && error ? (
          <div className="lg:col-span-8">
            <ErrorState
              title="The report could not be analyzed"
              description={error}
              onRetry={() => fileInputRef.current?.click()}
              retryLabel="Choose another file"
            />
          </div>
        ) : null}

        {!loading && !data && !error ? (
          <div className="lg:col-span-8">
            <EmptyState
              icon={Sparkles}
              title="No report analyzed yet"
              description={
                demoMode
                  ? "Demo mode is on. Upload any file to see the sample analysis flow."
                  : "Upload a PDF, TXT, MD, or DOCX report to run classification, extraction, and urgency assessment."
              }
              action={
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Choose file
                </Button>
              }
            />
          </div>
        ) : null}

        {data ? (
        <>
        {/* Center: AI Analysis */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="flex max-h-[380px] flex-col rounded-[20px] border border-border-subtle bg-surface shadow-soft">
            <CardHeader className="shrink-0 flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold text-text-primary">
                  AI analysis result
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {loading && (
                  <span className="text-[10px] text-text-secondary">Analyzing…</span>
                )}
                {data.confidence != null ? (
                  <Badge className="bg-primary-soft text-[11px] text-primary-strong">
                    {data.confidence}% confidence
                  </Badge>
                ) : null}
                <Badge tone={data.renderMode === "real" ? "success" : data.renderMode === "fallback" ? "warning" : "outline"}>
                  {modeLabel(data.renderMode)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pt-0">
              <div>
                <p className="text-[11px] font-medium text-text-secondary">
                  Predicted category
                </p>
                <p className="mt-0.5 text-sm font-semibold text-text-primary">
                  {data.category}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-text-secondary">
                  Plain-language summary
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-text-primary">
                  {data.plainLanguageSummary}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-text-secondary">
                  Top keywords
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {data.topKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-medium text-primary-strong"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-medium text-text-secondary">
                  Extracted findings
                </p>
                {data.findings.length > 0 ? (
                  <ul className="mt-1.5 space-y-1 text-[11px] text-text-primary">
                    {data.findings.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-[11px] text-text-secondary">
                    No structured findings were extracted from this result.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

              <div className="space-y-1">
            <div className="inline-flex items-center gap-1 rounded-full bg-surface-subtle p-1">
              {(["summary", "structured", "evidence", "history"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-pill-active text-surface"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {tab === "structured" ? "Structured Data" : tab === "summary" ? "Summary" : tab === "evidence" ? "Evidence" : "History"}
                </button>
              ))}
            </div>
            <Card className="flex max-h-[200px] flex-col rounded-[20px] border border-border-subtle bg-surface shadow-soft">
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {activeTab === "summary" && (
                  <p className="text-xs leading-relaxed text-text-secondary">
                    {data.category} — {data.plainLanguageSummary}
                  </p>
                )}
                {activeTab === "structured" && (
                  <pre className="overflow-x-auto text-[11px] text-text-secondary">
                    {JSON.stringify(data.structuredData, null, 2)}
                  </pre>
                )}
                {activeTab === "evidence" && (
                  <p className="text-xs text-text-secondary">
                    Cited evidence and guidelines will appear here.
                  </p>
                )}
                {activeTab === "history" && (
                  <p className="text-xs text-text-secondary">
                    Previous analyses for this session.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Right: Urgency + Next steps + Evidence */}
        <div className="space-y-4 lg:col-span-3">
          <Card className="rounded-[20px] border border-border-subtle bg-surface shadow-soft">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-danger" />
                <CardTitle className="text-sm font-semibold text-text-primary">
                  Urgency
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Badge tone="none" className={`gap-1.5 text-xs ${riskClasses(data.urgency).badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${riskClasses(data.urgency).dot}`} />
                {data.urgency}
              </Badge>
              {error && (
                <p className="mt-2 text-[11px] text-danger-text-alt">{error}</p>
              )}
              {timelineMessage && (
                <p className="mt-2 text-[11px] text-primary-strong">{timelineMessage}</p>
              )}
                  <p className="mt-2 text-[11px] text-text-secondary">
                    {modeLabel(data.renderMode)}
                    {data.aiMode ? ` · AI processing ${data.aiMode}` : ""}
                  </p>
                  {data.fallbackReason ? (
                    <p className="mt-1 text-[11px] text-text-secondary">
                      Fallback reason: {data.fallbackReason}
                    </p>
                  ) : null}
                  {data.safetyFlags.length > 0 ? (
                    <p className="mt-1 text-[11px] text-text-secondary">
                      Safety flags: {data.safetyFlags.join(", ")}
                    </p>
                  ) : null}
            </CardContent>
          </Card>

          <Card className="flex max-h-[240px] flex-col rounded-[20px] border border-border-subtle bg-surface shadow-soft">
            <CardHeader className="shrink-0 pb-2">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold text-text-primary">
                  Suggested next steps
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto pt-0">
              {data.suggestedNextSteps.map((s) => (
                <div
                  key={s}
                  className="flex items-start gap-2 rounded-[14px] bg-surface-muted px-3 py-2"
                >
                  <span className="text-[18px]">✓</span>
                  <p className="text-xs text-text-primary">{s}</p>
                </div>
              ))}
            </CardContent>
          </Card>

            <Card className="flex max-h-[260px] flex-col rounded-[20px] border border-border-subtle bg-surface shadow-soft">
            <CardHeader className="shrink-0 pb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold text-text-primary">
                  Cited evidence
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto pt-0">
              {data.citedEvidence.length > 0 ? (
                data.citedEvidence.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-[14px] border border-border-subtle bg-surface-muted px-3 py-2"
                  >
                    <p className="text-xs font-medium text-text-primary">{e.title}</p>
                    <p className="mt-0.5 text-[11px] text-text-secondary">{e.source}</p>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-text-secondary">
                  No report-specific evidence citations are attached to this analysis. Use the Knowledge Center for source lookup.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        </>
        ) : null}
      </div>
      {data ? <p className="text-[11px] text-text-secondary">{data.disclaimer}</p> : null}
    </div>
  );
}
