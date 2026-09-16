import * as React from "react";
import { cn } from "./cn";

// "none" applies no tone colours so className fully controls bg/text
// (class order alone cannot reliably override a tone).
export type BadgeTone = "default" | "success" | "warning" | "danger" | "outline" | "none";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  default: "bg-primary-soft text-primary-strong",
  success: "bg-success-soft text-success-strong",
  warning: "bg-warning-soft text-warning-strong",
  danger: "bg-danger-soft text-danger-text",
  outline:
    "border border-dashed border-border-subtle text-text-secondary bg-transparent",
  none: "",
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

