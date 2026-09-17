import { Check } from "lucide-react";
import { cn } from "@/components/ui/cn";

export type StepperProps = {
  steps: string[];
  /** 0-based index of the active step; steps.length means all done */
  current: number;
  className?: string;
};

/** Process stepper: done = filled + check, current = outlined, pending = muted. */
export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol className={cn("flex items-center", className)} aria-label={`Step ${Math.min(current + 1, steps.length)} of ${steps.length}`}>
      {steps.map((step, index) => {
        const state = index < current ? "done" : index === current ? "current" : "pending";
        return (
          <li key={step} className={cn("flex items-center", index < steps.length - 1 && "flex-1")} aria-current={state === "current" ? "step" : undefined}>
            <span className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-semibold",
                  state === "done" && "bg-accent-600 text-ink-on-accent",
                  state === "current" && "border-2 border-accent-600 text-accent-700",
                  state === "pending" && "border border-border-strong text-ink-400",
                )}
              >
                {state === "done" ? <Check className="h-3 w-3" aria-hidden="true" /> : index + 1}
              </span>
              <span className={cn("text-2xs", state === "pending" ? "text-ink-400" : "text-ink-700")}>{step}</span>
            </span>
            {index < steps.length - 1 ? (
              <span className={cn("mx-2 mb-4 h-[2px] flex-1", index < current ? "bg-accent-600" : "bg-border-strong")} aria-hidden="true" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
