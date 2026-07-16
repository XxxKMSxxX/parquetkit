import type { ColumnInfo } from "@/lib/engine/parquet/reader";

export interface ColumnTypeChange {
  name: string;
  leftType: string;
  leftLogicalType: string | null;
  rightType: string;
  rightLogicalType: string | null;
}

export interface SchemaDiff {
  /** Columns present only in the right (new) file. */
  added: ColumnInfo[];
  /** Columns present only in the left (old) file. */
  removed: ColumnInfo[];
  /** Columns present in both but with a different physical or logical type. */
  typeChanged: ColumnTypeChange[];
  /** Names of columns present in both files (including type-changed ones). */
  common: string[];
  identical: boolean;
}

/** Compare two parquet schemas (from hyparquet metadata, no data read). */
export function diffSchemas(left: ColumnInfo[], right: ColumnInfo[]): SchemaDiff {
  const leftByName = new Map(left.map((column) => [column.name, column]));
  const rightByName = new Map(right.map((column) => [column.name, column]));

  const added = right.filter((column) => !leftByName.has(column.name));
  const removed = left.filter((column) => !rightByName.has(column.name));
  const common = left
    .filter((column) => rightByName.has(column.name))
    .map((column) => column.name);

  const typeChanged: ColumnTypeChange[] = [];
  for (const name of common) {
    const l = leftByName.get(name);
    const r = rightByName.get(name);
    if (!l || !r) continue;
    if (l.type !== r.type || l.logicalType !== r.logicalType) {
      typeChanged.push({
        name,
        leftType: l.type,
        leftLogicalType: l.logicalType,
        rightType: r.type,
        rightLogicalType: r.logicalType,
      });
    }
  }

  return {
    added,
    removed,
    typeChanged,
    common,
    identical: added.length === 0 && removed.length === 0 && typeChanged.length === 0,
  };
}

/** Suggest join-key columns from the common columns ("id" first, then *_id). */
export function guessKeyColumns(common: string[]): string[] {
  const exact = common.find((name) => name.toLowerCase() === "id");
  if (exact) return [exact];
  const suffixed = common.find((name) => /(^|_)id$/i.test(name));
  return suffixed ? [suffixed] : [];
}
