import * as React from "react";
import { cn } from "./cn";

/** Shimmering placeholder block; size it with width/height utilities. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("rs-skeleton", className)} {...props} />;
}
