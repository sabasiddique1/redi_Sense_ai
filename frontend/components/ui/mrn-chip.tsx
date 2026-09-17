import { AlertTriangle } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { SeverityGlyph } from "@/components/ui/severity-glyph";
import type { RiskLevel } from "@/features/shared/risk";

export type MrnChipProps = {
  name: string;
  mrn: string | null;
  ageSex?: string | null;
  riskLevel?: RiskLevel | null;
  allergy?: boolean;
  compact?: boolean;
  className?: string;
};

/** Patient identity chip: risk glyph · name · mono MRN · age/sex · allergy flag. */
export function MrnChip({ name, mrn, ageSex, riskLevel = null, allergy = false, compact = false, className }: MrnChipProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2 text-sm text-ink-900", className)}>
      {riskLevel ? <SeverityGlyph level={riskLevel} size={9} /> : null}
      {!compact ? <span className="truncate font-semibold">{name}</span> : null}
      {!compact && mrn ? <span className="text-border-strong" aria-hidden="true">|</span> : null}
      {mrn ? (
        <span className="font-mono text-xs text-ink-700 rs-tabular">
          <span className="sr-only">MRN </span>
          {compact ? `MRN ${mrn}` : `MRN ${mrn}`}
        </span>
      ) : null}
      {!compact && ageSex ? (
        <>
          <span className="text-border-strong" aria-hidden="true">|</span>
          <span className="text-xs text-ink-500">{ageSex}</span>
        </>
      ) : null}
      {allergy ? (
        <AlertTriangle className="h-3.5 w-3.5 text-severity-high" aria-label="Allergy on file" role="img" />
      ) : null}
    </span>
  );
}
