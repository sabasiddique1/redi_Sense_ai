import * as React from "react";
import { cn } from "./cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[14px] border border-[#E6ECF5] bg-white px-3 text-sm text-[#101828] shadow-sm",
          "placeholder:text-[#98A2B3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C8DFF] focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:bg-[#F2F4F7]",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

