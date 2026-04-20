import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

export interface RecentActivityItem {
  id: string;
  time: string;
  label: string;
  detail: string;
}

export function RecentActivityPanel({
  items,
}: {
  items: RecentActivityItem[];
}) {
  return (
    <Card className="flex max-h-[260px] flex-col rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
      <CardHeader className="shrink-0 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 shrink-0 text-[#4C8DFF]" />
          <CardTitle>Recent activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto pt-0">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-2 rounded-[14px] bg-[#F8FAFD] px-3 py-2"
          >
            <div className="flex flex-col">
              <p className="text-xs font-medium text-[#101828]">{item.label}</p>
              <p className="text-[11px] text-[#667085]">{item.detail}</p>
            </div>
            <span className="whitespace-nowrap text-[11px] text-[#98A2B3]">
              {item.time}
            </span>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-[11px] text-[#98A2B3]">
            No activity yet for this session.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

