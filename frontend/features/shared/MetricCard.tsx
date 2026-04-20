import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, AlertTriangle, Clock, FileCheck } from "lucide-react";

const METRIC_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "reports-today": BarChart3,
  "high-risk": AlertTriangle,
  "triage-time": Clock,
  "evidence-linked": FileCheck,
};

export interface Metric {
  id: string;
  label: string;
  value: string;
  trend: "up" | "down" | "neutral";
  trendLabel: string;
  pill?: string;
}

export function MetricCard({ metric }: { metric: Metric }) {
  const trendColor =
    metric.trend === "up"
      ? "text-[#22C55E]"
      : metric.trend === "down"
      ? "text-[#EF4444]"
      : "text-[#667085]";

  return (
    <Card className="rounded-[20px] border border-[#E6ECF5] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
      <CardHeader className="p-0 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {METRIC_ICONS[metric.id] && (
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF2FF] text-[#4C8DFF]">
                {(() => {
                  const Icon = METRIC_ICONS[metric.id];
                  return Icon ? <Icon className="h-3.5 w-3.5" /> : null;
                })()}
              </span>
            )}
            <CardTitle className="text-xs font-medium text-[#667085]">
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
        <p className="text-xl font-semibold tracking-tight text-[#101828]">
          {metric.value}
        </p>
        <p className={`mt-1 text-[11px] ${trendColor}`}>{metric.trendLabel}</p>
      </CardContent>
    </Card>
  );
}

