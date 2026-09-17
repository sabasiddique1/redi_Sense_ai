"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export type DataTableColumn<Row> = {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  sortable?: boolean;
  align?: "left" | "right";
  width?: string;
  /** Mono + tabular numerals (MRN, timestamps) */
  mono?: boolean;
};

export type SortState = { column: string; direction: "asc" | "desc" } | null;

export type DataTableProps<Row> = {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  onRowSelect?: (row: Row) => void;
  selectedKey?: string | null;
  zebra?: boolean;
  density?: "compact" | "comfortable";
  emptyMessage?: string;
  caption: string;
  className?: string;
};

/** Hairline table with sortable headers and keyboard-operable rows (Enter/Space select). */
export function DataTable<Row>({ columns, rows, rowKey, sort = null, onSortChange, onRowSelect, selectedKey, zebra, density = "compact", emptyMessage = "No rows to show.", caption, className }: DataTableProps<Row>) {
  const pad = density === "compact" ? "px-3 py-2" : "px-3 py-3";
  const toggleSort = (column: DataTableColumn<Row>) => {
    if (!column.sortable || !onSortChange) return;
    if (sort?.column === column.id) {
      onSortChange(sort.direction === "desc" ? { column: column.id, direction: "asc" } : null);
    } else {
      onSortChange({ column: column.id, direction: "desc" });
    }
  };

  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border-hairline", className)}>
      <table className="min-w-full border-collapse text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-sunken">
          <tr>
            {columns.map((column) => {
              const sorted = sort?.column === column.id ? sort.direction : null;
              return (
                <th
                  key={column.id}
                  scope="col"
                  style={{ width: column.width }}
                  aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : column.sortable ? "none" : undefined}
                  className={cn(pad, "text-left text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500", column.align === "right" && "text-right")}
                >
                  {column.sortable ? (
                    <button type="button" onClick={() => toggleSort(column)} className="inline-flex items-center gap-1 hover:text-ink-900">
                      {column.header}
                      {sorted === "asc" ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className={cn("h-3 w-3", !sorted && "opacity-40")} aria-hidden="true" />}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const key = rowKey(row);
            const selectable = Boolean(onRowSelect);
            return (
              <tr
                key={key}
                tabIndex={selectable ? 0 : undefined}
                aria-selected={selectable ? selectedKey === key : undefined}
                onClick={selectable ? () => onRowSelect?.(row) : undefined}
                onKeyDown={
                  selectable
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowSelect?.(row);
                        }
                      }
                    : undefined
                }
                className={cn(
                  "border-t border-border-hairline",
                  zebra && index % 2 === 1 && "bg-surface-sunken/60",
                  selectable && "cursor-pointer hover:bg-surface-sunken focus-visible:bg-accent-050",
                  selectedKey === key && "bg-accent-050",
                )}
              >
                {columns.map((column) => (
                  <td key={column.id} className={cn(pad, "align-top text-ink-700", column.align === "right" && "text-right", column.mono && "font-mono rs-tabular")}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-xs text-ink-400">
                {emptyMessage}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
