import { buildReadExpression, quoteLiteral } from "@/lib/engine/convert/jobs";

/** Presence marker column added to each side of the join. Key columns can be
 *  NULL in the data, so presence must not be inferred from them. */
const PRESENT = "__pqkit_present__";

const IN_BOTH = `l.${PRESENT} IS NOT NULL AND r.${PRESENT} IS NOT NULL`;

export type DiffRowStatus = "added" | "removed" | "changed";

export interface DiffSqlOptions {
  oldFileName: string;
  newFileName: string;
  /** Join-key columns (must exist in both files). */
  keys: string[];
  /** Non-key columns compared for changes. */
  compareColumns: string[];
  /** Cast keys to VARCHAR in the join predicate (when key types differ). */
  castKeys?: boolean;
}

/** Escaping for DuckDB SQL identifiers. */
export function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function assertKeys(keys: string[]): void {
  if (keys.length === 0) {
    throw new Error("At least one key column is required to diff rows");
  }
}

function cte(options: DiffSqlOptions): string {
  const left = buildReadExpression("parquet", options.oldFileName);
  const right = buildReadExpression("parquet", options.newFileName);
  return (
    `WITH l AS (SELECT *, TRUE AS ${PRESENT} FROM ${left}), ` +
    `r AS (SELECT *, TRUE AS ${PRESENT} FROM ${right})`
  );
}

function joinOn(keys: string[], castKeys: boolean): string {
  return keys
    .map((key) => {
      const quoted = quoteIdent(key);
      const [left, right] = castKeys
        ? [`CAST(l.${quoted} AS VARCHAR)`, `CAST(r.${quoted} AS VARCHAR)`]
        : [`l.${quoted}`, `r.${quoted}`];
      return `${left} IS NOT DISTINCT FROM ${right}`;
    })
    .join(" AND ");
}

function anyDiff(compareColumns: string[]): string {
  if (compareColumns.length === 0) return "FALSE";
  return compareColumns
    .map((column) => {
      const quoted = quoteIdent(column);
      return `l.${quoted} IS DISTINCT FROM r.${quoted}`;
    })
    .join(" OR ");
}

/** Count added/removed/changed/unchanged rows in a single aggregated query
 *  (the full join is never materialized into JS). */
export function buildDiffSummarySql(options: DiffSqlOptions): string {
  assertKeys(options.keys);
  const diff = anyDiff(options.compareColumns);
  return (
    `${cte(options)} SELECT ` +
    `count(*) FILTER (WHERE l.${PRESENT} IS NULL) AS added, ` +
    `count(*) FILTER (WHERE r.${PRESENT} IS NULL) AS removed, ` +
    `count(*) FILTER (WHERE ${IN_BOTH} AND (${diff})) AS changed, ` +
    `count(*) FILTER (WHERE ${IN_BOTH} AND NOT (${diff})) AS unchanged ` +
    `FROM l FULL OUTER JOIN r ON ${joinOn(options.keys, options.castKeys ?? false)}`
  );
}

/** Paged detail rows for one diff status. Changed rows render only the cells
 *  that differ, as an "old → new" string built in SQL. */
export function buildDiffRowsSql(
  options: DiffSqlOptions & { status: DiffRowStatus; limit: number; offset: number },
): string {
  assertKeys(options.keys);
  const limit = Math.max(0, Math.floor(options.limit));
  const offset = Math.max(0, Math.floor(options.offset));
  const join = `FROM l FULL OUTER JOIN r ON ${joinOn(options.keys, options.castKeys ?? false)}`;
  const paging = `LIMIT ${limit} OFFSET ${offset}`;

  if (options.status === "added" || options.status === "removed") {
    const side = options.status === "added" ? "r" : "l";
    const absent =
      options.status === "added" ? `l.${PRESENT} IS NULL` : `r.${PRESENT} IS NULL`;
    const columns = [...options.keys, ...options.compareColumns]
      .map((column) => `${side}.${quoteIdent(column)} AS ${quoteIdent(column)}`)
      .join(", ");
    const order = options.keys.map((key) => `${side}.${quoteIdent(key)}`).join(", ");
    return `${cte(options)} SELECT ${columns} ${join} WHERE ${absent} ORDER BY ${order} ${paging}`;
  }

  const keyColumns = options.keys.map(
    (key) => `l.${quoteIdent(key)} AS ${quoteIdent(key)}`,
  );
  const changeColumns = options.compareColumns.map((column) => {
    const quoted = quoteIdent(column);
    return (
      `CASE WHEN l.${quoted} IS DISTINCT FROM r.${quoted} ` +
      `THEN concat(coalesce(CAST(l.${quoted} AS VARCHAR), 'NULL'), ' → ', ` +
      `coalesce(CAST(r.${quoted} AS VARCHAR), 'NULL')) END AS ${quoted}`
    );
  });
  const order = options.keys.map((key) => `l.${quoteIdent(key)}`).join(", ");
  return (
    `${cte(options)} SELECT ${[...keyColumns, ...changeColumns].join(", ")} ${join} ` +
    `WHERE ${IN_BOTH} AND (${anyDiff(options.compareColumns)}) ORDER BY ${order} ${paging}`
  );
}

/** Total vs distinct row counts for the chosen keys (uniqueness warning). */
export function buildKeyUniquenessSql(fileName: string, keys: string[]): string {
  assertKeys(keys);
  const read = buildReadExpression("parquet", fileName);
  const columns = keys.map(quoteIdent).join(", ");
  return (
    `SELECT (SELECT count(*) FROM ${read}) AS total_rows, ` +
    `(SELECT count(*) FROM (SELECT DISTINCT ${columns} FROM ${read})) AS distinct_rows`
  );
}

/** Re-exported so callers building custom expressions share the escaping. */
export { quoteLiteral };
