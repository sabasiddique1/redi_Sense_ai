"use client";

import { PageHeader } from "../shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockTimelineEvents } from "../mock-data/timeline";

export function TimelinePage() {
  const events = mockTimelineEvents;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Patient Timeline"
        subtitle="Chronological view of reports, medications, symptom checks, and findings."
      />

      <div className="max-w-2xl">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-[#E6ECF5]" />

          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="relative flex gap-4">
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#4C8DFF] text-xs font-semibold text-white shadow-[0_2px_8px_rgba(76,141,255,0.3)]">
                  {event.type.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 pb-4">
                  <Card className="rounded-[20px] border border-[#E6ECF5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[#98A2B3]">
                          {event.date} · {event.time}
                        </span>
                        <Badge tone="outline" className="text-[10px]">
                          {event.type}
                        </Badge>
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-[#101828]">
                        {event.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-[#667085]">
                        {event.detail}
                      </p>
                      {event.findings && (
                        <ul className="mt-2 space-y-0.5 text-[11px] text-[#667085]">
                          {event.findings.map((f) => (
                            <li key={f} className="flex items-start gap-2">
                              <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-[#4C8DFF]" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
