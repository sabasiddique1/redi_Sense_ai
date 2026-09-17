import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { riskClasses, type RiskLevel } from "./risk";

export interface ReportRow {
  id: string;
  patientName: string;
  patientId: string;
  modality: string;
  summary: string;
  risk: RiskLevel;
  receivedAt: string;
}

export function ReportsTable({ reports }: { reports: ReportRow[] }) {
  return (
    <Card className="flex max-h-[320px] flex-col rounded-[20px] border border-border-subtle bg-surface shadow-soft">
      <CardHeader className="shrink-0 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <div>
            <CardTitle>Reports queue</CardTitle>
            <p className="mt-0.5 text-[11px] text-text-secondary">
              Prioritized by AI risk assessment and red flags.
            </p>
            </div>
          </div>
          <span className="text-[11px] text-text-tertiary">
            {reports.length} in queue
          </span>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden pt-0">
        <div className="h-full max-h-[220px] overflow-y-auto rounded-[16px] border border-border-subtle bg-surface">
          <table className="min-w-full border-collapse text-xs">
            <thead className="bg-surface-muted">
              <tr className="text-[11px] text-text-secondary">
                <th className="px-3 py-2 text-left font-medium">Patient</th>
                <th className="px-3 py-2 text-left font-medium">Report</th>
                <th className="px-3 py-2 text-left font-medium">Risk</th>
                <th className="px-3 py-2 text-left font-medium">Received</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-surface-subtle hover:bg-surface-hover"
                >
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col">
                      <span className="text-[12px] font-medium text-text-primary">
                        {r.patientName}
                      </span>
                      <span className="text-[11px] text-text-tertiary">
                        {r.patientId}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-medium text-text-secondary">
                        {r.modality}
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-[11px] text-text-tertiary">
                        {r.summary}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Badge tone="none" className={`gap-1.5 text-[10px] ${riskClasses(r.risk).badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${riskClasses(r.risk).dot}`} />
                      {r.risk}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 align-top text-[11px] text-text-secondary">
                    {r.receivedAt}
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-[11px] text-text-tertiary"
                  >
                    No reports in the queue right now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

