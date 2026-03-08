import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface Insight {
  id: string;
  title: string;
  summary: string;
  confidence: number;
}

export function InsightCard({ insight }: { insight: Insight }) {
  return (
    <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>AI signal of the day</CardTitle>
          <Badge className="bg-[#EAF2FF] text-[10px] text-[#1D4ED8]">
            {insight.confidence}% confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        <p className="text-xs font-semibold text-[#101828]">{insight.title}</p>
        <p className="text-[11px] leading-relaxed text-[#667085]">
          {insight.summary}
        </p>
      </CardContent>
    </Card>
  );
}

