import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { riskClasses, riskSolidBadgeClasses } from "./risk";

export interface UrgentAlert {
  id: string;
  label: string;
  patientName: string;
  detail: string;
  severity: "High" | "Critical";
}

export function AlertCard({ alerts }: { alerts: UrgentAlert[] }) {
  return (
    <Card className="flex max-h-[240px] flex-col rounded-[20px] border border-border-subtle bg-surface shadow-soft">
      <CardHeader className="shrink-0 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-risk-critical" />
            <CardTitle>Urgent alerts</CardTitle>
          </div>
          <Badge tone="none" className={`text-[10px] ${riskClasses("Critical").badge}`}>
            {alerts.length} flagged
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto pt-0">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`flex items-start gap-2 rounded-[16px] border px-3 py-2 ${riskClasses(alert.severity).soft} ${riskClasses(alert.severity).border}`}
          >
            <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${riskClasses(alert.severity).text}`} />
            <div className="flex flex-1 items-center justify-between gap-2">
              <div>
                <p className={`text-xs font-semibold ${riskClasses(alert.severity).text}`}>
                  {alert.label}
                </p>
                <p className="text-[11px] text-text-body">{alert.detail}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium text-text-body">
                  {alert.patientName}
                </p>
                <Badge
                  tone="none"
                  className={`mt-1 text-[10px] ${riskSolidBadgeClasses(alert.severity)}`}
                >
                  {alert.severity}
                </Badge>
              </div>
            </div>
          </div>
        ))}
        {alerts.length === 0 && (
          <p className="text-[11px] text-risk-low-text">
            No urgent safety alerts at the moment.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

