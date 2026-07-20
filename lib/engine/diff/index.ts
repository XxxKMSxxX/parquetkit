import type * as duckdb from "@duckdb/duckdb-wasm";
import { registerFile, runQuery, type QueryResult } from "@/lib/engine/duckdb";
import {
  buildDiffRowsSql,
  buildDiffSummarySql,
  buildKeyUniquenessSql,
  type DiffRowStatus,
  type DiffSqlOptions,
} from "./sql";
import type { DiffReportRowsInput } from "./report";

export type { DiffRowStatus, DiffSqlOptions } from "./sql";
export * from "./schema";
export * from "./report";

/** Row cap per status when fetching a full (unpaged) diff for report export. */
export const MAX_REPORT_ROWS = 50_000;

export interface DiffSummary {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
}

export interface KeyUniqueness {
  totalRows: number;
  distinctRows: number;
  unique: boolean;
}

/** Virtual file names of one registered diff input pair. */
export interface DiffInputs {
  oldFileName: string;
  newFileName: string;
}

/** The per-query options the UI provides (file names come from DiffInputs). */
export type DiffParams = Omit<DiffSqlOptions, "oldFileName" | "newFileName">;

// DuckDB caches parquet metadata by file name, so re-registering different
// content under a previously used name serves stale bytes. Every registration
// gets a fresh namespaced name instead (the prefix also avoids clashing with
// files the SQL workbench registered — the DuckDB instance is a shared singleton).
let registrationCounter = 0;

/** Register both inputs under unique namespaced names. */
export async function registerDiffInputs(
  db: duckdb.AsyncDuckDB,
  oldFile: File,
  newFile: File,
): Promise<DiffInputs> {
  registrationCounter += 1;
  const inputs: DiffInputs = {
    oldFileName: `__pqkit_diff_old_${registrationCounter}__.parquet`,
    newFileName: `__pqkit_diff_new_${registrationCounter}__.parquet`,
  };
  await registerFile(db, inputs.oldFileName, oldFile);
  await registerFile(db, inputs.newFileName, newFile);
  return inputs;
}

/** Drop both inputs (no-op when already dropped). */
export async function dropDiffInputs(
  db: duckdb.AsyncDuckDB,
  inputs: DiffInputs,
): Promise<void> {
  await db.dropFile(inputs.oldFileName).catch(() => undefined);
  await db.dropFile(inputs.newFileName).catch(() => undefined);
}

/** Validate that the chosen keys are unique within one registered input. */
export async function checkKeyUniqueness(
  db: duckdb.AsyncDuckDB,
  fileName: string,
  keys: string[],
): Promise<KeyUniqueness> {
  const result = await runQuery(db, buildKeyUniquenessSql(fileName, keys));
  const row = result.rows[0] ?? {};
  const totalRows = Number(row.total_rows ?? 0);
  const distinctRows = Number(row.distinct_rows ?? 0);
  return { totalRows, distinctRows, unique: totalRows === distinctRows };
}

/** Added/removed/changed/unchanged counts (aggregated inside DuckDB). */
export async function fetchDiffSummary(
  db: duckdb.AsyncDuckDB,
  inputs: DiffInputs,
  params: DiffParams,
): Promise<DiffSummary> {
  const result = await runQuery(db, buildDiffSummarySql({ ...params, ...inputs }));
  const row = result.rows[0] ?? {};
  return {
    added: Number(row.added ?? 0),
    removed: Number(row.removed ?? 0),
    changed: Number(row.changed ?? 0),
    unchanged: Number(row.unchanged ?? 0),
  };
}

/** One page of detail rows for a diff status. */
export async function fetchDiffRows(
  db: duckdb.AsyncDuckDB,
  inputs: DiffInputs,
  params: DiffParams & { status: DiffRowStatus; limit: number; offset: number },
): Promise<QueryResult> {
  return runQuery(db, buildDiffRowsSql({ ...params, ...inputs }));
}

/** All rows for one status, capped at MAX_REPORT_ROWS (never silently — check `truncated`). */
async function fetchAllRowsForStatus(
  db: duckdb.AsyncDuckDB,
  inputs: DiffInputs,
  params: DiffParams & { status: DiffRowStatus },
): Promise<{ result: QueryResult; truncated: boolean }> {
  const result = await fetchDiffRows(db, inputs, {
    ...params,
    limit: MAX_REPORT_ROWS + 1,
    offset: 0,
  });
  const truncated = result.rows.length > MAX_REPORT_ROWS;
  if (!truncated) return { result, truncated };
  const capped = result.rows.slice(0, MAX_REPORT_ROWS);
  return { result: { ...result, rows: capped, numRows: capped.length }, truncated };
}

/** Full (unpaged) added/removed/changed rows for report export, each capped at MAX_REPORT_ROWS. */
export async function fetchAllDiffRows(
  db: duckdb.AsyncDuckDB,
  inputs: DiffInputs,
  params: DiffParams,
): Promise<DiffReportRowsInput> {
  const [added, removed, changed] = await Promise.all([
    fetchAllRowsForStatus(db, inputs, { ...params, status: "added" }),
    fetchAllRowsForStatus(db, inputs, { ...params, status: "removed" }),
    fetchAllRowsForStatus(db, inputs, { ...params, status: "changed" }),
  ]);
  return {
    added: added.result,
    removed: removed.result,
    changed: changed.result,
    truncated: added.truncated || removed.truncated || changed.truncated,
  };
}
