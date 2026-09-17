"use client";

import { cn } from "@/components/ui/cn";

export type ToggleSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  labels?: [string, string];
  disabled?: boolean;
  className?: string;
};

/** 34×18 switch with the accent on state. */
export function ToggleSwitch({ checked, onChange, label, labels, disabled, className }: ToggleSwitchProps) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-xs text-ink-700", disabled && "cursor-not-allowed opacity-60", className)}>
      {labels ? <span className={cn(!checked && "font-semibold text-ink-900")}>{labels[0]}</span> : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative h-[18px] w-[34px] rounded-pill transition-colors duration-[var(--rs-motion-fast)]", checked ? "bg-accent-600" : "bg-border-strong")}
      >
        <span className={cn("absolute top-[2px] h-[14px] w-[14px] rounded-full bg-surface transition-[left] duration-[var(--rs-motion-fast)]", checked ? "left-[18px]" : "left-[2px]")} />
      </button>
      {labels ? <span className={cn(checked && "font-semibold text-ink-900")}>{labels[1]}</span> : null}
    </label>
  );
}
