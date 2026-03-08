import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface UrgentAlert {
  id: string;
  label: string;
  patientName: string;
  detail: string;
  severity: "High" | "Critical";
}

export function AlertCard({ alerts }: { alerts: UrgentAlert[] }) {
  return (
    <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Urgent alerts</CardTitle>
          <Badge tone="danger" className="text-[10px]">
            {alerts.length} flagged
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="rounded-[16px] border border-[#FEE2E2] bg-[#FEF2F2] px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
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

