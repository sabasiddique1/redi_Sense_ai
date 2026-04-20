import * as React from "react";
import { cn } from "./cn";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 4, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          "flex w-full rounded-[14px] border border-[#E6ECF5] bg-white px-3 py-2 text-sm text-[#101828] shadow-sm resize-none",
          "placeholder:text-[#98A2B3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C8DFF] focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:bg-[#F2F4F7]",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

