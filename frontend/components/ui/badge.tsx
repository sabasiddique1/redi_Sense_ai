import * as React from "react";
import { cn } from "./cn";

export type BadgeTone = "default" | "success" | "warning" | "danger" | "outline";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  default: "bg-[#EAF2FF] text-[#1D4ED8]",
  success: "bg-[#ECFDF3] text-[#166534]",
  warning: "bg-[#FEF3C7] text-[#92400E]",
  danger: "bg-[#FEF2F2] text-[#B91C1C]",
  outline:
    "border border-dashed border-[#E6ECF5] text-[#667085] bg-transparent",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone = "default", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium leading-none",
          toneClasses[tone],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";

