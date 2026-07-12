/** Stringify an arbitrary value for table-cell display. */
export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    return JSON.stringify(value, (_key, v: unknown) =>
      typeof v === "bigint" ? v.toString() : v,
    );
  }
  return String(value);
}

/** Serialize query results to a CSV string (RFC 4180 quoting). */
export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const escape = (raw: string): string =>
    /[",\n\r]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
  const lines = [columns.map(escape).join(",")];
  for (const row of rows) {
    lines.push(columns.map((col) => escape(formatCell(row[col]))).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
