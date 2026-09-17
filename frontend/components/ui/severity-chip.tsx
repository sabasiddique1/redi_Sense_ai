import { cn } from "@/components/ui/cn";
import { SeverityGlyph } from "@/components/ui/severity-glyph";
import { riskClasses, riskSolidBadgeClasses, type RiskLevel } from "@/features/shared/risk";

export type SeverityChipProps = {
  level: RiskLevel | null;
  label?: string;
  size?: "sm" | "md";
  variant?: "tint" | "solid";
  showGlyph?: boolean;
  className?: string;
};

/** Severity chip: tint by default, glyph + label; solid for alerts. */
export function SeverityChip({ level, label, size = "sm", variant = "tint", showGlyph = true, className }: SeverityChipProps) {
  const text = label ?? level ?? "Unknown";
  const tone = level ? (variant === "solid" ? riskSolidBadgeClasses(level) : riskClasses(level).badge) : "bg-surface-sunken text-ink-500";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill font-semibold tracking-[0.03em]",
        size === "sm" ? "px-2 py-0.5 text-2xs" : "px-2.5 py-1 text-xs",
        tone,
        className,
      )}
    >
      {showGlyph ? <SeverityGlyph level={level} size={size === "sm" ? 7 : 9} className={variant === "solid" ? "!bg-ink-on-accent" : undefined} /> : null}
      {text}
    </span>
  );
}
