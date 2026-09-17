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
    <Card className="flex max-h-[260px] flex-col rounded-[20px] border border-border-subtle bg-surface shadow-soft">
      <CardHeader className="shrink-0 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 shrink-0 text-primary" />
          <CardTitle>Recent activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto pt-0">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-2 rounded-[14px] bg-surface-muted px-3 py-2"
          >
            <div className="flex flex-col">
              <p className="text-xs font-medium text-text-primary">{item.label}</p>
              <p className="text-[11px] text-text-secondary">{item.detail}</p>
            </div>
            <span className="whitespace-nowrap text-[11px] text-text-tertiary">
              {item.time}
            </span>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-[11px] text-text-tertiary">
            No activity yet for this session.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

