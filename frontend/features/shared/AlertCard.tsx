import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export interface UrgentAlert {
  id: string;
  label: string;
  patientName: string;
  detail: string;
  severity: "High" | "Critical";
}

export function AlertCard({ alerts }: { alerts: UrgentAlert[] }) {
  return (
    <Card className="flex max-h-[240px] flex-col rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
      <CardHeader className="shrink-0 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#EF4444]" />
            <CardTitle>Urgent alerts</CardTitle>
          </div>
          <Badge tone="danger" className="text-[10px]">
            {alerts.length} flagged
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto pt-0">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-start gap-2 rounded-[16px] border border-[#FEE2E2] bg-[#FEF2F2] px-3 py-2"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B91C1C]" />
            <div className="flex flex-1 items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-[#B91C1C]">
                  {alert.label}
                </p>
                <p className="text-[11px] text-[#7F1D1D]">{alert.detail}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium text-[#7F1D1D]">
                  {alert.patientName}
                </p>
                <Badge
                  tone="danger"
                  className="mt-1 bg-[#B91C1C] text-[10px] text-white"
                >
                  {alert.severity}
                </Badge>
              </div>
            </div>
          </div>
        ))}
        {alerts.length === 0 && (
          <p className="text-[11px] text-[#15803D]">
            No urgent safety alerts at the moment.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

