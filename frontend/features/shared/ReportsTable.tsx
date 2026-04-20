import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

export interface ReportRow {
  id: string;
  patientName: string;
  patientId: string;
  modality: string;
  summary: string;
  risk: "Low" | "Moderate" | "High" | "Critical";
  receivedAt: string;
}

const riskTone: Record<ReportRow["risk"], { bg: string; text: string }> = {
  Low: { bg: "bg-[#ECFDF3]", text: "text-[#166534]" },
  Moderate: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]" },
  High: { bg: "bg-[#FEF3C7]", text: "text-[#B45309]" },
  Critical: { bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]" },
};

export function ReportsTable({ reports }: { reports: ReportRow[] }) {
  return (
    <Card className="flex max-h-[320px] flex-col rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
      <CardHeader className="shrink-0 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-[#4C8DFF]" />
            <div>
            <CardTitle>Reports queue</CardTitle>
            <p className="mt-0.5 text-[11px] text-[#667085]">
              Prioritized by AI risk assessment and red flags.
            </p>
            </div>
          </div>
          <span className="text-[11px] text-[#98A2B3]">
            {reports.length} in queue
          </span>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden pt-0">
        <div className="h-full max-h-[220px] overflow-y-auto rounded-[16px] border border-[#E6ECF5] bg-white">
          <table className="min-w-full border-collapse text-xs">
            <thead className="bg-[#F8FAFD]">
              <tr className="text-[11px] text-[#667085]">
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
                  className="border-t border-[#F2F4F7] hover:bg-[#F9FAFB]"
                >
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col">
                      <span className="text-[12px] font-medium text-[#101828]">
                        {r.patientName}
                      </span>
                      <span className="text-[11px] text-[#98A2B3]">
                        {r.patientId}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-medium text-[#667085]">
                        {r.modality}
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-[11px] text-[#98A2B3]">
                        {r.summary}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Badge
                      className={`text-[10px] ${riskTone[r.risk].bg} ${
                        riskTone[r.risk].text
                      }`}
                    >
                      {r.risk}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 align-top text-[11px] text-[#667085]">
                    {r.receivedAt}
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-[11px] text-[#98A2B3]"
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

