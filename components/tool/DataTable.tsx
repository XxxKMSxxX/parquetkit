"use client";

import { formatCell } from "@/lib/engine/format/cell";

interface DataTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
  /** Row number of the first row (0-based, shown for pagination) */
  offset?: number;
}

export function DataTable({ columns, rows, offset = 0 }: DataTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-sm" data-testid="data-table">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-left dark:border-neutral-800 dark:bg-neutral-900">
            <th className="px-3 py-2 font-medium text-neutral-400">#</th>
            {columns.map((col) => (
              <th key={col} className="whitespace-nowrap px-3 py-2 font-semibold">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={offset + i}
              className="border-b border-neutral-100 last:border-0 dark:border-neutral-900"
            >
              <td className="px-3 py-1.5 text-neutral-400">{offset + i + 1}</td>
              {columns.map((col) => (
                <td
                  key={col}
                  className="max-w-xs truncate whitespace-nowrap px-3 py-1.5 font-mono text-xs"
                  title={formatCell(row[col])}
                >
                  {formatCell(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
