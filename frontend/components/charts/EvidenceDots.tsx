import { cn } from "@/components/ui/cn";

export type EvidenceDotsProps = { filled: number; of?: number; className?: string };

/** "2 of 3 sources support this finding" as filled / hollow dots. */
export function EvidenceDots({ filled, of = 3, className }: EvidenceDotsProps) {
  const n = Math.max(0, Math.min(of, filled));
  return (
    <span className={cn("inline-flex items-center gap-1", className)} role="img" aria-label={`${n} of ${of} sources support this finding`}>
      {Array.from({ length: of }).map((_, i) => (
        <span key={i} className={cn("inline-block h-[7px] w-[7px] rounded-full", i < n ? "bg-accent-600" : "bg-ink-300")} />
      ))}
    </span>
  );
}
