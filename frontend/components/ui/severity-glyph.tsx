import { cn } from "@/components/ui/cn";
import { riskClasses, type RiskLevel } from "@/features/shared/risk";

const SHAPE: Record<string, string> = {
  circle: "rounded-full",
  triangle: "[clip-path:polygon(50%_0,100%_100%,0_100%)]",
  diamond: "rotate-45 rounded-[1px]",
  octagon: "[clip-path:polygon(30%_0,70%_0,100%_30%,100%_70%,70%_100%,30%_100%,0_70%,0_30%)]",
};

/** Shape-coded severity marker so colour is never the only encoding. */
export function SeverityGlyph({ level, size = 9, className }: { level: RiskLevel | null; size?: number; className?: string }) {
  const classes = riskClasses(level);
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0", level ? classes.bar : "bg-ink-300", level ? SHAPE[classes.glyph] : "rounded-full", className)}
      style={{ width: size, height: size }}
    />
  );
}
