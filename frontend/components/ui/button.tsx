import * as React from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "ghost" | "outline" | "pill";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const baseClasses =
  "inline-flex items-center justify-center rounded-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary disabled:opacity-60 disabled:cursor-not-allowed gap-2";

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-3.5 text-sm",
  lg: "h-11 px-4 text-sm",
  icon: "h-9 w-9 text-sm",
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-ink-on-accent hover:bg-primary-hover ",
  ghost:
    "bg-transparent text-text-primary hover:bg-primary-soft border border-transparent",
  outline:
    "bg-surface text-text-primary border border-border-subtle hover:bg-surface-muted",
  pill: "rounded-full bg-pill-active text-surface hover:bg-ink-700",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(baseClasses, sizeClasses[size], variantClasses[variant], className)}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading && (
          <span className="h-3 w-3 rounded-full border-2 border-surface border-t-transparent animate-spin" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

