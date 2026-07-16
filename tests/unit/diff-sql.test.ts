import { describe, expect, it } from "vitest";
import {
  buildDiffRowsSql,
  buildDiffSummarySql,
  buildKeyUniquenessSql,
  quoteIdent,
} from "@/lib/engine/diff/sql";

const BASE = {
  oldFileName: "old.parquet",
  newFileName: "new.parquet",
  keys: ["id"],
  compareColumns: ["name", "score"],
};

describe("quoteIdent", () => {
  it("quotes and escapes identifiers", () => {
    expect(quoteIdent("id")).toBe('"id"');
    expect(quoteIdent('we"ird')).toBe('"we""ird"');
  });
});

describe("buildDiffSummarySql", () => {
  it("counts every status in a single aggregated query", () => {
    const sql = buildDiffSummarySql(BASE);
    expect(sql).toContain(
      "WITH l AS (SELECT *, TRUE AS __pqkit_present__ FROM read_parquet('old.parquet'))",
    );
    expect(sql).toContain("count(*) FILTER (WHERE l.__pqkit_present__ IS NULL) AS added");
    expect(sql).toContain("count(*) FILTER (WHERE r.__pqkit_present__ IS NULL) AS removed");
    expect(sql).toContain('l."name" IS DISTINCT FROM r."name" OR l."score" IS DISTINCT FROM r."score"');
    expect(sql).toContain('FULL OUTER JOIN r ON l."id" IS NOT DISTINCT FROM r."id"');
  });

  it("casts keys to VARCHAR when requested", () => {
    const sql = buildDiffSummarySql({ ...BASE, castKeys: true });
    expect(sql).toContain('CAST(l."id" AS VARCHAR) IS NOT DISTINCT FROM CAST(r."id" AS VARCHAR)');
  });

  it("multi-column keys join on every key", () => {
    const sql = buildDiffSummarySql({ ...BASE, keys: ["tenant", "id"] });
    expect(sql).toContain(
      'l."tenant" IS NOT DISTINCT FROM r."tenant" AND l."id" IS NOT DISTINCT FROM r."id"',
    );
  });

  it("no compare columns means nothing can be changed", () => {
    const sql = buildDiffSummarySql({ ...BASE, compareColumns: [] });
    expect(sql).toContain("AND (FALSE)) AS changed");
  });

  it("rejects an empty key list", () => {
    expect(() => buildDiffSummarySql({ ...BASE, keys: [] })).toThrow(/key column/);
  });
});

describe("buildDiffRowsSql", () => {
  it("added rows come from the right side only", () => {
    const sql = buildDiffRowsSql({ ...BASE, status: "added", limit: 50, offset: 0 });
    expect(sql).toContain('SELECT r."id" AS "id", r."name" AS "name", r."score" AS "score"');
    expect(sql).toContain("WHERE l.__pqkit_present__ IS NULL");
    expect(sql).toContain('ORDER BY r."id" LIMIT 50 OFFSET 0');
  });

  it("removed rows come from the left side only", () => {
    const sql = buildDiffRowsSql({ ...BASE, status: "removed", limit: 10, offset: 20 });
    expect(sql).toContain('SELECT l."id" AS "id"');
    expect(sql).toContain("WHERE r.__pqkit_present__ IS NULL");
    expect(sql).toContain("LIMIT 10 OFFSET 20");
  });

  it("changed rows render only differing cells as old → new", () => {
    const sql = buildDiffRowsSql({ ...BASE, status: "changed", limit: 50, offset: 0 });
    expect(sql).toContain(
      `CASE WHEN l."name" IS DISTINCT FROM r."name" THEN concat(coalesce(CAST(l."name" AS VARCHAR), 'NULL'), ' → ', coalesce(CAST(r."name" AS VARCHAR), 'NULL')) END AS "name"`,
    );
    expect(sql).toContain("WHERE l.__pqkit_present__ IS NOT NULL AND r.__pqkit_present__ IS NOT NULL");
  });

  it("clamps limit and offset to non-negative integers", () => {
    const sql = buildDiffRowsSql({ ...BASE, status: "added", limit: 50.9, offset: -3 });
    expect(sql).toContain("LIMIT 50 OFFSET 0");
  });
});

describe("buildKeyUniquenessSql", () => {
  it("compares total and distinct counts", () => {
    expect(buildKeyUniquenessSql("f.parquet", ["id"])).toBe(
      "SELECT (SELECT count(*) FROM read_parquet('f.parquet')) AS total_rows, " +
        `(SELECT count(*) FROM (SELECT DISTINCT "id" FROM read_parquet('f.parquet'))) AS distinct_rows`,
    );
  });

  it("supports composite keys", () => {
    expect(buildKeyUniquenessSql("f.parquet", ["a", "b"])).toContain('SELECT DISTINCT "a", "b" FROM');
  });
});
