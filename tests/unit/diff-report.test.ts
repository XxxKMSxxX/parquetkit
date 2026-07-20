import { describe, expect, it } from "vitest";
import { buildDiffReportHtml, buildDiffReportMarkdown } from "@/lib/engine/diff/report";
import type { DiffReportInput } from "@/lib/engine/diff/report";
import type { SchemaDiff } from "@/lib/engine/diff/schema";
import type { DiffSummary } from "@/lib/engine/diff";
import type { QueryResult } from "@/lib/engine/duckdb";

const META = {
  oldFileName: "orders_v1.parquet",
  newFileName: "orders_v2.parquet",
  key: "id",
  generatedAt: "2026-07-20T00:00:00.000Z",
};

const IDENTICAL_SCHEMA: SchemaDiff = {
  added: [],
  removed: [],
  typeChanged: [],
  common: ["id", "name"],
  identical: true,
};

const CHANGED_SCHEMA: SchemaDiff = {
  added: [{ name: "region", type: "BYTE_ARRAY", logicalType: "STRING" }],
  removed: [{ name: "nullable", type: "BYTE_ARRAY", logicalType: "STRING" }],
  typeChanged: [
    { name: "score", leftType: "DOUBLE", leftLogicalType: null, rightType: "INT64", rightLogicalType: null },
  ],
  common: ["id", "score"],
  identical: false,
};

const SUMMARY: DiffSummary = { added: 1, removed: 1, changed: 2, unchanged: 5 };

function result(columns: string[], rows: Record<string, unknown>[]): QueryResult {
  return { columns, rows, numRows: rows.length };
}

const BASE_INPUT: DiffReportInput = {
  meta: META,
  schemaDiff: IDENTICAL_SCHEMA,
  summary: SUMMARY,
};

describe("buildDiffReportMarkdown", () => {
  it("renders meta and summary counts", () => {
    const md = buildDiffReportMarkdown(BASE_INPUT);
    expect(md).toContain("orders_v1.parquet");
    expect(md).toContain("orders_v2.parquet");
    expect(md).toContain("`id`");
    expect(md).toContain("2026-07-20T00:00:00.000Z");
    expect(md).toContain("| Added | 1 |");
    expect(md).toContain("| Removed | 1 |");
    expect(md).toContain("| Changed | 2 |");
    expect(md).toContain("| Unchanged | 5 |");
  });

  it("reports an identical schema in prose", () => {
    const md = buildDiffReportMarkdown(BASE_INPUT);
    expect(md).toContain("Schemas are identical (2 columns).");
  });

  it("lists added/removed/type-changed columns", () => {
    const md = buildDiffReportMarkdown({ ...BASE_INPUT, schemaDiff: CHANGED_SCHEMA });
    expect(md).toContain("+ region (STRING) — only in new file");
    expect(md).toContain("− nullable (STRING) — only in old file");
    expect(md).toContain("~ score: DOUBLE → INT64");
  });

  it("without rows, is a free-preview report with no row tables", () => {
    const md = buildDiffReportMarkdown(BASE_INPUT);
    expect(md).not.toContain("### Added");
    expect(md).toMatch(/upgrade/i);
  });

  it("with rows, renders a full row-level report per status", () => {
    const md = buildDiffReportMarkdown({
      ...BASE_INPUT,
      rows: {
        added: result(["id", "name"], [{ id: 1, name: "a" }]),
        removed: result(["id", "name"], []),
        changed: result(["id", "name"], [{ id: 2, name: "0.5 → 1.5" }]),
        truncated: false,
      },
    });
    expect(md).toContain("### Added (1)");
    expect(md).toContain("| id | name |");
    expect(md).toContain("| 1 | a |");
    expect(md).toContain("### Changed (1)");
    expect(md).toContain("| 2 | 0.5 → 1.5 |");
    expect(md).not.toMatch(/upgrade/i);
  });

  it("escapes pipe characters and newlines inside cell values", () => {
    const md = buildDiffReportMarkdown({
      ...BASE_INPUT,
      rows: {
        added: result(["id", "note"], [{ id: 1, note: "a|b\nc" }]),
        removed: result(["id"], []),
        changed: result(["id"], []),
        truncated: false,
      },
    });
    expect(md).toContain("a\\|b c");
  });

  it("notes truncation when rows were capped", () => {
    const md = buildDiffReportMarkdown({
      ...BASE_INPUT,
      rows: {
        added: result(["id"], []),
        removed: result(["id"], []),
        changed: result(["id"], []),
        truncated: true,
      },
    });
    expect(md).toMatch(/truncated/i);
  });

  it("is deterministic for the same input (no Date.now() inside)", () => {
    expect(buildDiffReportMarkdown(BASE_INPUT)).toBe(buildDiffReportMarkdown(BASE_INPUT));
  });
});

describe("buildDiffReportHtml", () => {
  it("renders a self-contained HTML document with meta and summary", () => {
    const html = buildDiffReportHtml(BASE_INPUT);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("orders_v1.parquet");
    expect(html).toContain("orders_v2.parquet");
    expect(html).toMatch(/Added[\s\S]*1/);
  });

  it("escapes HTML-significant characters in cell values", () => {
    const html = buildDiffReportHtml({
      ...BASE_INPUT,
      rows: {
        added: result(["id", "note"], [{ id: 1, note: "<script>alert(1)</script>" }]),
        removed: result(["id"], []),
        changed: result(["id"], []),
        truncated: false,
      },
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("without rows, is a free-preview report with no row tables", () => {
    const html = buildDiffReportHtml(BASE_INPUT);
    expect(html).not.toContain('id="added"');
    expect(html).toMatch(/upgrade/i);
  });

  it("notes truncation when rows were capped", () => {
    const html = buildDiffReportHtml({
      ...BASE_INPUT,
      rows: {
        added: result(["id"], []),
        removed: result(["id"], []),
        changed: result(["id"], []),
        truncated: true,
      },
    });
    expect(html).toMatch(/truncated/i);
  });
});
