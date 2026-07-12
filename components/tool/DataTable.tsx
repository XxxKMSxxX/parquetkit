"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatCell, toJson } from "@/lib/engine/format/cell";

interface DataTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
  /** Row number of the first row (0-based, shown for pagination) */
  offset?: number;
}

export function DataTable({ columns, rows, offset = 0 }: DataTableProps) {
  // Click a cell to copy its full (untruncated) value
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Numbers read right-aligned with lined-up digits, like every data tool.
  // DECIMAL values arrive as numeric strings (see runQuery), so a column is
  // numeric when every sampled non-null value is a number, bigint or "12.5"
  const numericColumns = useMemo(() => {
    const isNumeric = (value: unknown) =>
      typeof value === "number" ||
      typeof value === "bigint" ||
      (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value));
    const sample = rows.slice(0, 50);
    const numeric = new Set<string>();
    for (const col of columns) {
      const values = sample
        .map((row) => row[col])
        .filter((value) => value !== null && value !== undefined);
      if (values.length > 0 && values.every(isNumeric)) numeric.add(col);
    }
    return numeric;
  }, [columns, rows]);

  const copyCell = (key: string, value: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopiedCell(key);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiedCell(null), 1200);
    });
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-sm" data-testid="data-table">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-left dark:border-neutral-800 dark:bg-neutral-900">
            <th className="px-3 py-2 font-medium text-neutral-400" title="Click a row number to copy the row as JSON">
              #
            </th>
            {columns.map((col) => (
              <th
                key={col}
                className={`whitespace-nowrap px-3 py-2 font-semibold ${
                  numericColumns.has(col) ? "text-right" : ""
                }`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={offset + i}
              className="border-b border-neutral-100 transition-colors last:border-0 hover:bg-neutral-50/60 dark:border-neutral-900 dark:hover:bg-neutral-900/40"
            >
              <td
                onClick={() => copyCell(`row:${offset + i}`, toJson(row))}
                title="Copy row as JSON"
                className={`cursor-copy px-3 py-1.5 transition-colors ${
                  copiedCell === `row:${offset + i}`
                    ? "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
                    : "text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
                }`}
              >
                {copiedCell === `row:${offset + i}` ? "✓" : offset + i + 1}
              </td>
              {columns.map((col) => {
                const value = formatCell(row[col]);
                const key = `${offset + i}:${col}`;
                const copied = copiedCell === key;
                return (
                  <td
                    key={col}
                    onClick={() => copyCell(key, value)}
                    className={`max-w-xs cursor-copy truncate whitespace-nowrap px-3 py-1.5 font-mono text-xs transition-colors ${
                      numericColumns.has(col) ? "text-right tabular-nums" : ""
                    } ${
                      copied
                        ? "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
                    }`}
                    title={copied ? "Copied!" : `${value}\n(click to copy)`}
                  >
                    {copied ? "Copied!" : value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
