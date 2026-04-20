import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart } from "lucide-react";

export interface RiskBucket {
  label: string;
  value: number;
  color: string;
}

export function RiskDistributionChart({
  distribution,
}: {
  distribution: RiskBucket[];
}) {
  const total = distribution.reduce((sum, b) => sum + b.value, 0) || 1;

  return (
    <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <PieChart className="h-4 w-4 shrink-0 text-[#4C8DFF]" />
          <CardTitle>Risk distribution (last 24h)</CardTitle>
        </div>
        <p className="mt-0.5 text-[11px] text-[#667085]">
          Compact stacked bar summarizing triage risk across all incoming
          reports.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-1">
        <div className="flex h-4 overflow-hidden rounded-full border border-[#E6ECF5] bg-[#F8FAFD]">
          {distribution.map((bucket) => {
            const width = `${(bucket.value / total) * 100}%`;
            return (
              <div
                key={bucket.label}
                style={{ width }}
                className={bucket.color}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3">
          {distribution.map((bucket) => (
            <div key={bucket.label} className="flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 rounded-full border border-white shadow-sm ${bucket.color}`}
              />
              <span className="text-[11px] text-[#667085]">
                {bucket.label}{" "}
                <span className="font-medium text-[#101828]">
                  {bucket.value}
                </span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

