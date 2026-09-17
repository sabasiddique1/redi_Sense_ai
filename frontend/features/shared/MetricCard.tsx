import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, AlertTriangle, Clock, FileCheck, Users } from "lucide-react";
import { riskClasses, type RiskLevel } from "./risk";

const METRIC_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "reports-today": BarChart3,
  "high-risk": AlertTriangle,
  "triage-time": Clock,
  "active-patients": Users,
  "evidence-linked": FileCheck,
};

export interface Metric {
  id: string;
  label: string;
  value: string;
  trend: "up" | "down" | "neutral";
  trendLabel: string;
  pill?: string;
  /** Colours the icon chip on the clinical risk scale. */
  accent?: RiskLevel;
}

export function MetricCard({ metric }: { metric: Metric }) {
  const trendColor =
    metric.trend === "up"
      ? "text-success"
      : metric.trend === "down"
      ? "text-danger"
      : "text-text-secondary";

  return (
    <Card className="rounded-[20px] border border-border-subtle bg-surface p-5 shadow-soft">
      <CardHeader className="p-0 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {METRIC_ICONS[metric.id] && (
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                  metric.accent
                    ? `${riskClasses(metric.accent).soft} ${riskClasses(metric.accent).text}`
                    : "bg-primary-soft text-primary"
                }`}
              >
                {(() => {
                  const Icon = METRIC_ICONS[metric.id];
                  return Icon ? <Icon className="h-3.5 w-3.5" /> : null;
                })()}
              </span>
            )}
            <CardTitle className="text-xs font-medium text-text-secondary">
              {metric.label}
            </CardTitle>
          </div>
          {metric.pill && (
            <Badge tone="outline" className="text-[10px]">
              {metric.pill}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <p className="text-xl font-semibold tracking-tight text-text-primary">
          {metric.value}
        </p>
        <p className={`mt-1 text-[11px] ${trendColor}`}>{metric.trendLabel}</p>
      </CardContent>
    </Card>
  );
}

