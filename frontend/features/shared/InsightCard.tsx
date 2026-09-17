import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb } from "lucide-react";

export interface Insight {
  id: string;
  title: string;
  summary: string;
  confidence: number;
  /** Overrides the "N% confidence" badge, e.g. "Based on 12 records" for connected data. */
  basis?: string;
}

export function InsightCard({ insight }: { insight: Insight }) {
  return (
    <Card className="rounded-[20px] border border-border-subtle bg-surface shadow-soft">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 shrink-0 text-warning" />
            <CardTitle>AI signal of the day</CardTitle>
          </div>
          <Badge className="bg-primary-soft text-[10px] text-primary-strong">
            {insight.basis ?? `${insight.confidence}% confidence`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        <p className="text-xs font-semibold text-text-primary">{insight.title}</p>
        <p className="text-[11px] leading-relaxed text-text-secondary">
          {insight.summary}
        </p>
      </CardContent>
    </Card>
  );
}

