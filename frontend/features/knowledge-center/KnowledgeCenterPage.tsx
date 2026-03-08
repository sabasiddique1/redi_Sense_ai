"use client";

import { useState } from "react";
import { PageHeader } from "../shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockEvidenceResults } from "../mock-data/knowledge-center";

export function KnowledgeCenterPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<typeof mockEvidenceResults | null>(null);

  const handleSearch = () => {
    setResults(mockEvidenceResults);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Knowledge Center"
        subtitle="Search clinical guidelines and evidence. &quot;Used in this answer&quot; highlights cited sources."
      />

      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Search guidelines, evidence, or clinical topics..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="max-w-md rounded-[14px] border-[#E6ECF5]"
          />
          <Button onClick={handleSearch}>Search</Button>
        </div>

        {results ? (
          <div className="grid gap-4 md:grid-cols-2">
            {results.map((item) => (
              <Card
                key={item.id}
                className={`rounded-[20px] border shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)] ${
                  item.usedInAnswer
                    ? "border-[#4C8DFF] bg-[#EAF2FF]/50"
                    : "border-[#E6ECF5] bg-white"
                }`}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-semibold text-[#101828]">
                    {item.title}
                  </CardTitle>
                  {item.usedInAnswer && (
                    <Badge className="bg-[#4C8DFF] text-[10px] text-white">
                      Used in this answer
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-[#667085]">{item.source}</p>
                  <p className="mt-2 text-xs leading-relaxed text-[#101828]">
                    {item.summary}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="rounded-[20px] border border-[#E6ECF5] bg-white p-12 text-center shadow-[0_18px_45px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.02)]">
            <p className="text-sm text-[#98A2B3]">
              Enter a search term to retrieve guideline summaries and evidence.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
