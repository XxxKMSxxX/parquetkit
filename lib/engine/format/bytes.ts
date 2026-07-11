const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes === 0) return "0 B";
  const exp = Math.min(Math.floor(Math.log2(bytes) / 10), UNITS.length - 1);
  const value = bytes / 2 ** (10 * exp);
  const rounded = exp === 0 ? String(value) : value.toFixed(value >= 100 ? 0 : 1);
  return `${rounded} ${UNITS[exp]}`;
}

export function formatRowCount(rows: bigint | number): string {
  return new Intl.NumberFormat("en-US").format(rows);
}
