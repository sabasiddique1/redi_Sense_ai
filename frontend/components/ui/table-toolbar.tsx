"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/components/ui/cn";

export type ToolbarFilter = { id: string; label: string; active: boolean };

export type TableToolbarProps = {
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  filters?: ToolbarFilter[];
  onToggleFilter?: (id: string) => void;
  density?: "compact" | "comfortable";
  onDensityChange?: (density: "compact" | "comfortable") => void;
  className?: string;
};

/** Search pill · filter chips · filter icon · density, above a data table. */
export function TableToolbar({ searchValue = "", searchPlaceholder = "Search", onSearchChange, filters = [], onToggleFilter, density, onDensityChange, className }: TableToolbarProps) {
  const activeCount = filters.filter((f) => f.active).length;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {onSearchChange ? (
        <label className="relative flex min-w-[200px] flex-1 items-center sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
          <span className="sr-only">{searchPlaceholder}</span>
          <input
            type="search"
            value={searchValue}
            placeholder={searchPlaceholder}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-8 w-full rounded-pill border border-border-hairline bg-surface-sunken pl-8 pr-3 text-xs text-ink-900 placeholder:text-ink-400"
          />
        </label>
      ) : null}
      {filters.map((filter) => (
        <button
          key={filter.id}
          type="button"
          aria-pressed={filter.active}
          onClick={() => onToggleFilter?.(filter.id)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-xs font-medium transition-colors",
            filter.active ? "border-accent-100 bg-accent-050 text-accent-700" : "border-border-hairline text-ink-500 hover:bg-surface-sunken",
          )}
        >
          {filter.label}
          {filter.active ? <X className="h-3 w-3" aria-hidden="true" /> : null}
        </button>
      ))}
      {filters.length > 0 ? (
        <span className="inline-flex h-8 items-center gap-1 rounded-pill border border-border-hairline px-2.5 text-xs text-ink-500" aria-label={`${activeCount} filters active`}>
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Filter{activeCount ? ` · ${activeCount}` : ""}
        </span>
      ) : null}
      {density && onDensityChange ? (
        <button
          type="button"
          onClick={() => onDensityChange(density === "compact" ? "comfortable" : "compact")}
          className="ml-auto text-2xs text-ink-500 hover:text-ink-900"
          aria-label={`Density: ${density}. Switch to ${density === "compact" ? "comfortable" : "compact"}`}
        >
          Density: <span className="font-semibold text-ink-700">{density === "compact" ? "Compact" : "Comfortable"}</span>
        </button>
      ) : null}
    </div>
  );
}
