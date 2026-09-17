"use client";

import { useEffect, useRef, useState } from "react";
import { FileSearch, ListChecks, Sparkles, Upload } from "lucide-react";

import { Stepper } from "@/components/charts/Stepper";
import { Button } from "@/components/ui/button";
import { DisclaimerBar } from "@/components/ui/disclaimer-bar";
import { SeverityGlyph } from "@/components/ui/severity-glyph";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/hooks/useAppState";
import { ApiError, apiClient } from "@/lib/api";
import type { AiMode, FallbackReason, ReportAnalysisResponse, ReportUploadResponse, ResultMode } from "@/lib/contracts";
import { mockReportAnalysis } from "../mock-data/report-analyzer";
import { PageHeader } from "../shared/PageHeader";
import { EmptyState, ErrorState, SkeletonCard } from "../shared/PageStates";
import { EvidenceChips, VerdictBlock } from "../shared/VerdictBlock";
import { isEscalationLevel, type RiskLevel } from "../shared/risk";

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

const ANALYSIS_STEPS = ["Extract", "Analyze", "Ground", "Verify"];
const ACCEPTED_FORMATS = "PDF, TXT, MD, DOCX up to 10MB";

function buildDemoUploadResponse(filename: string, patientId: number | null): ReportUploadResponse {
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
    disclaimer: "Clinical decision support only. Verify findings with licensed clinical judgment.",
    mode: "demo",
    ai_mode: null,
    fallback_reason: null,
    timeline_event_id: null,
    created_at: new Date().toISOString(),
    filename,
    mime_type: "text/plain",
    text_preview: mockReportAnalysis.reportPreview,
  };
}

function extractKeywords(payload: ReportAnalysisResponse): string[] {
  if (payload.top_keywords && payload.top_keywords.length > 0) return payload.top_keywords;
  const values = [
    ...(payload.extracted_findings ?? payload.key_findings),
    payload.predicted_category ?? payload.classification,
    ...Object.values(payload.structured_data).map((value) => String(value)),
  ]
    .join(" ")
    .toLowerCase()
    .match(/[a-z0-9-]{4,}/g);
  if (!values) return [];
  return Array.from(new Set(values)).slice(0, 6);
}

function deriveUrgency(payload: ReportAnalysisResponse): RiskLevel {
  const safetyFlags = payload.safety_flags ?? [];
  const flagText = safetyFlags.join(" ").toLowerCase();
  if (/critical|emergen|immediate/.test(flagText)) return "Critical";
  if (safetyFlags.includes("urgent_review_language_present") || safetyFlags.includes("suspicious_language_present")) return "High";
  if ((payload.follow_up_recommendations ?? []).length > 0) return "Moderate";
  const joined = `${payload.predicted_category ?? payload.classification} ${payload.plain_language_summary ?? payload.summary}`.toLowerCase();
  if (joined.includes("malign") || joined.includes("spicul") || joined.includes("critical") || joined.includes("enlarg")) return "High";
  if (safetyFlags.length === 0 && (payload.extracted_findings ?? payload.key_findings).length === 0) return "Low";
  return "Moderate";
}

function buildNextSteps(payload: ReportAnalysisResponse): string[] {
  if (payload.follow_up_recommendations && payload.follow_up_recommendations.length > 0) return payload.follow_up_recommendations;
  const recommendation = payload.structured_data.recommendation;
  if (typeof recommendation === "string" && recommendation.trim()) {
    return recommendation.split(/,|;/).map((step) => step.trim()).filter(Boolean);
  }
  return [
    "Review the extracted report content with the care team.",
    "Correlate the result with prior imaging and the original report text.",
    "Document follow-up actions in the patient timeline.",
  ];
}

/** Severity marker per finding, from urgency wording in the finding itself. */
function findingLevel(finding: string, urgency: RiskLevel): RiskLevel {
  const text = finding.toLowerCase();
  if (/critical|emergen|acute|hemorrh|rupture/.test(text)) return "Critical";
  if (/enlarg|increase|new |suspicious|spicul|malign|concern|recommend/.test(text)) return urgency === "Low" ? "Moderate" : "High";
  if (/stable|no |normal|unchanged|benign/.test(text)) return "Low";
  return urgency === "Critical" ? "High" : "Moderate";
}

function mapToView(payload: ReportAnalysisResponse, filename: string | null, preview: string | null): ReportAnalysisView {
  return {
    reportPreview: preview || "No text preview was returned for this report.",
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
    uploadedFilename: filename,
    timelineEventId: payload.timeline_event_id,
  };
}

export function ReportAnalyzerPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { demoMode, selectedPatient, selectedPatientId, notifyPatientActivity } = useAppState();
  // Starts empty in both modes; the demo analysis is produced only when a
  // report is submitted while demo mode is on (via the fallback below).
  const [analysis, setAnalysis] = useState<ReportAnalysisView | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [timelineMessage, setTimelineMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Client-side phase indicator; the API is a single request, so the stepper
  // advances on a timer and completes when the response lands.
  useEffect(() => {
    if (!loading) return;
    setStep(0);
    const timer = window.setInterval(() => setStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1)), 700);
    return () => window.clearInterval(timer);
  }, [loading]);

  const finish = (payload: ReportAnalysisResponse, mode: ResultMode, warning: string | undefined, filename: string | null, preview: string | null) => {
    setAnalysis(mapToView(payload, filename, preview));
    setError(warning ?? null);
    if (mode !== "demo" && payload.timeline_event_id && selectedPatientId) {
      const message = "Report analysis saved and patient timeline updated.";
      setTimelineMessage(message);
      notifyPatientActivity(message, selectedPatientId);
    } else if (mode === "demo") {
      setTimelineMessage("Demo mode result only. No timeline event was created.");
    }
  };

  const analyzeFile = async (file: File) => {
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
      finish(result.data, result.mode, result.warning, result.data.filename, result.data.text_preview);
      setUploadProgress(result.mode === "demo" ? 0 : 100);
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Unable to upload and analyze the report right now.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await analyzeFile(file);
    event.target.value = "";
  };

  const handleAnalyzeText = async () => {
    const text = pastedText.trim();
    if (text.length < 20) {
      setError("Paste at least 20 characters of report text, or upload a file.");
      return;
    }
    setLoading(true);
    setError(null);
    setTimelineMessage(null);
    try {
      const result = await apiClient.analyzeReportText(
        { patient_id: selectedPatientId, report_text: text },
        {
          demoMode,
          fallback: () => buildDemoUploadResponse("pasted-text.txt", selectedPatientId),
          fallbackMessage: "Demo mode is enabled. Showing demo analysis.",
        },
      );
      finish(result.data, result.mode, result.warning, null, text.slice(0, 1200));
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Unable to analyze the pasted text right now.");
    } finally {
      setLoading(false);
    }
  };

  const data = analysis;
  const evidenceChips =
    data && data.citedEvidence.length > 0
      ? data.citedEvidence.map((item) => ({ id: item.id, label: item.title, query: item.title, section: item.source }))
      : (data?.topKeywords ?? []).map((keyword) => ({ id: keyword, label: keyword, query: keyword }));
  const escalate = !!data && (isEscalationLevel(data.urgency) || /urgent|escalat|critical|immediate/.test(data.safetyFlags.join(" ").toLowerCase()));

  return (
    <div className="space-y-5">
      <PageHeader title="Report Analyzer" subtitle="Upload medical reports for AI-powered classification, extraction, and evidence-backed guidance." />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        {/* Source */}
        <section className="card-surface flex flex-col gap-4 p-5" aria-labelledby="analyzer-source-title">
          <div>
            <h2 id="analyzer-source-title" className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <FileSearch className="h-4 w-4 text-accent-600" aria-hidden="true" />
              Source
            </h2>
            <p className="mt-0.5 text-2xs text-ink-500">{selectedPatient ? `Linked patient: ${selectedPatient.name}` : "No patient selected"}</p>
          </div>

          <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.docx,application/pdf" className="hidden" onChange={handleFileChange} aria-label="Upload report file" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void analyzeFile(file);
            }}
            disabled={loading}
            className={`flex min-h-[150px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed p-5 text-center transition-colors ${
              dragging ? "border-accent-600 bg-accent-050" : "border-border-strong bg-surface-sunken hover:border-accent-600"
            }`}
          >
            <Upload className="mb-2 h-8 w-8 text-ink-400" aria-hidden="true" />
            <span className="text-sm font-semibold text-ink-900">Drop a report file</span>
            <span className="mt-0.5 text-2xs text-ink-500">or click to browse — {ACCEPTED_FORMATS}</span>
            {data?.uploadedFilename ? <span className="mt-2 font-mono text-2xs text-ink-500">Last upload: {data.uploadedFilename}</span> : null}
            {loading && uploadProgress > 0 ? <span className="mt-1 text-2xs text-accent-700 rs-tabular">Upload progress: {uploadProgress}%</span> : null}
          </button>

          <div className="flex items-center gap-3 text-2xs font-semibold uppercase tracking-[0.05em] text-ink-400" aria-hidden="true">
            <span className="h-px flex-1 bg-border-hairline" />
            Or paste text
            <span className="h-px flex-1 bg-border-hairline" />
          </div>
          <Textarea
            rows={6}
            value={pastedText}
            onChange={(event) => setPastedText(event.target.value)}
            placeholder="FINDINGS: 3mm noncalcified nodule right upper lobe, stable compared to prior study…"
            aria-label="Report text"
            className="font-mono text-xs"
          />
          <Button onClick={handleAnalyzeText} className="w-full gap-2" disabled={loading} loading={loading}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {loading ? "Analyzing…" : "Analyze report"}
          </Button>
          {timelineMessage ? <p className="text-2xs text-accent-700">{timelineMessage}</p> : null}
          {error && data ? <p className="text-2xs text-severity-critical" role="alert">{error}</p> : null}

          <details className="rounded-md border border-border-hairline bg-surface-sunken px-3 py-2">
            <summary className="cursor-pointer text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">Report preview</summary>
            <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-2xs leading-relaxed text-ink-700">
              {data ? data.reportPreview : "The extracted report text will appear here after analysis."}
            </pre>
          </details>
        </section>

        {/* Analysis */}
        <div className="space-y-4">
          {loading && !data ? (
            <div className="space-y-4" aria-busy="true">
              <div className="card-surface p-5">
                <p className="text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">Loading — analyzing</p>
                <Stepper steps={ANALYSIS_STEPS} current={step} className="mt-4" />
              </div>
              <SkeletonCard lines={5} />
              <SkeletonCard lines={3} />
            </div>
          ) : null}

          {!loading && !data && error ? (
            <ErrorState title="Couldn't analyze this report" description={error} onRetry={() => fileInputRef.current?.click()} retryLabel="Choose another file" />
          ) : null}

          {!loading && !data && !error ? (
            <EmptyState
              icon={Sparkles}
              title="No report loaded"
              description={demoMode ? "Demo mode is on. Upload or paste any report to see the sample analysis flow." : "Upload or paste a report to begin."}
              action={
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Choose file
                </Button>
              }
            />
          ) : null}

          {data ? (
            <>
              <VerdictBlock
                severityLabel="Urgency"
                severity={data.urgency}
                secondary={data.category}
                confidence={data.confidence}
                confidenceNote={data.confidence == null ? "The connected analysis does not score confidence." : "Demo score for the sample report."}
                escalate={escalate}
                escalationText={data.safetyFlags.length > 0 ? `Safety flags: ${data.safetyFlags.join(", ")}` : "No safety flags were raised by the analyzer."}
                basis={data.aiMode ? `AI processing: ${data.aiMode}${data.fallbackReason ? ` · ${data.fallbackReason}` : ""}` : "Extraction-grounded analysis"}
                mode={data.renderMode}
              />

              <section className="card-surface space-y-4 p-5" aria-labelledby="analyzer-result-title">
                <div>
                  <h2 id="analyzer-result-title" className="text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">Classification</h2>
                  <p className="mt-1 text-sm font-semibold text-ink-900">{data.category}</p>
                </div>
                <div>
                  <h3 className="text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">Summary</h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-700">{data.plainLanguageSummary}</p>
                </div>
                <div>
                  <h3 className="text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">Findings</h3>
                  {data.findings.length > 0 ? (
                    <ul className="mt-2 space-y-1.5">
                      {data.findings.map((finding) => (
                        <li key={finding} className="flex items-start gap-2 text-xs text-ink-700">
                          <SeverityGlyph level={findingLevel(finding, data.urgency)} size={8} className="mt-1.5" />
                          {finding}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-ink-500">No structured findings were extracted from this result.</p>
                  )}
                </div>
                <div>
                  <h3 className="text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">Keywords</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {data.topKeywords.map((keyword) => (
                      <span key={keyword} className="rounded-pill bg-accent-050 px-2.5 py-0.5 text-2xs font-medium text-accent-700">{keyword}</span>
                    ))}
                    {data.topKeywords.length === 0 ? <span className="text-2xs text-ink-400">None extracted</span> : null}
                  </div>
                </div>
              </section>

              <section className="card-surface p-5" aria-labelledby="analyzer-recs-title">
                <h2 id="analyzer-recs-title" className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                  <ListChecks className="h-4 w-4 text-accent-600" aria-hidden="true" />
                  Recommendations
                </h2>
                <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs text-ink-700">
                  {data.suggestedNextSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>

              <section className="card-surface p-5" aria-labelledby="analyzer-citations-title">
                <h2 id="analyzer-citations-title" className="text-sm font-semibold text-ink-900">Citations</h2>
                <p className="mt-0.5 text-2xs text-ink-500">
                  {data.citedEvidence.length > 0 ? "Cited evidence for this analysis" : "No report-specific citations are attached. Keyword lookups open the Knowledge Center."}
                </p>
                <div className="mt-3">
                  <EvidenceChips title="" items={evidenceChips} />
                </div>
              </section>

              <details className="card-surface px-5 py-3">
                <summary className="cursor-pointer text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">Structured data</summary>
                <pre className="mt-2 overflow-x-auto font-mono text-2xs text-ink-700">{JSON.stringify(data.structuredData, null, 2)}</pre>
              </details>

              <DisclaimerBar text={data.disclaimer} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
