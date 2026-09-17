"use client";

import { cn } from "@/components/ui/cn";

export type SegmentedOption<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** chip = filter row; segment = ink-900 filled active state */
  variant?: "chip" | "segment";
  className?: string;
};

/** Accessible radio-group styled as chips or a segmented control. */
export function SegmentedControl<T extends string>({ options, value, onChange, label, variant = "segment", className }: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex items-center gap-1", variant === "segment" && "rounded-md border border-border-hairline bg-surface-sunken p-0.5", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-[5px] px-3 py-1 text-xs font-medium transition-colors",
              variant === "segment"
                ? active
                  ? "bg-ink-900 text-surface"
                  : "text-ink-500 hover:text-ink-900"
                : active
                  ? "rounded-pill bg-accent-050 text-accent-700 ring-1 ring-accent-100"
                  : "rounded-pill border border-border-hairline text-ink-500 hover:bg-surface-sunken",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
