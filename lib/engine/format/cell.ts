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

/** Serialize a row to pretty JSON, stringifying values JSON cannot represent. */
export function toJson(row: Record<string, unknown>): string {
  return JSON.stringify(
    row,
    (_key, value) => {
      if (typeof value === "bigint") return value.toString();
      if (value instanceof Date) return value.toISOString();
      if (value instanceof Uint8Array) return formatCell(value);
      return value;
    },
    2,
  );
}
