import { Info } from "lucide-react";
import { cn } from "@/components/ui/cn";

export const DEFAULT_DISCLAIMER = "Decision support only — verify against clinical judgment and source record.";

/** Standing, non-modal disclaimer strip pinned under every AI output. */
export function DisclaimerBar({ text = DEFAULT_DISCLAIMER, className }: { text?: string; className?: string }) {
  return (
    <p role="note" className={cn("flex items-start gap-2 rounded-md border border-border-hairline bg-surface-sunken px-3 py-2 text-2xs text-ink-500", className)}>
      <Info className="mt-px h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}
