import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/components/ui/cn";

export type CitationChipProps = {
  index: number;
  title: string;
  section?: string | null;
  /** 0–1 relevance score, tabular */
  score?: number | null;
  /** Knowledge Center query; defaults to the title */
  query?: string;
  href?: string;
  className?: string;
};

/** [n] title, Sec. x.y · score, deep-linking into the Knowledge Center. */
export function CitationChip({ index, title, section, score, query, href, className }: CitationChipProps) {
  const target = href ?? `/knowledge-center?query=${encodeURIComponent(query ?? title)}`;
  return (
    <Link
      href={target}
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-md border border-border-hairline bg-surface px-2.5 py-1 text-xs text-ink-700 transition-colors hover:border-accent-600 hover:text-accent-700",
        className,
      )}
      title={`Open in Knowledge Center: ${title}`}
    >
      <span className="font-mono text-2xs text-accent-700" aria-hidden="true">[{index}]</span>
      <span className="sr-only">Citation {index}: </span>
      <span className="truncate">
        {title}
        {section ? <span className="text-ink-500">, {section}</span> : null}
      </span>
      {score != null ? <span className="font-mono text-2xs text-ink-500 rs-tabular">{score.toFixed(2)}</span> : null}
      <ArrowUpRight className="h-3 w-3 shrink-0 text-ink-400" aria-hidden="true" />
    </Link>
  );
}
