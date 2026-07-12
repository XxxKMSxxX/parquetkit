import { describe, expect, it } from "vitest";
import {
  SUPPORTED_CONVERSIONS,
  buildConversionSql,
  conversionSlug,
  outputFileMeta,
  parseConversionSlug,
} from "@/lib/engine/convert/jobs";

describe("conversionSlug / parseConversionSlug", () => {
  it("every supported pair round-trips through its slug", () => {
    for (const pair of SUPPORTED_CONVERSIONS) {
      expect(parseConversionSlug(conversionSlug(pair))).toEqual(pair);
    }
  });

  it("returns null for unsupported slugs", () => {
    expect(parseConversionSlug("parquet-to-xlsx")).toBeNull();
    expect(parseConversionSlug("json-to-parquet")).toBeNull();
    expect(parseConversionSlug("")).toBeNull();
  });
});

describe("buildConversionSql", () => {
  it("parquet→csv", () => {
    expect(
      buildConversionSql({ from: "parquet", to: "csv" }, "in.parquet", "out.csv"),
    ).toBe(
      "COPY (SELECT * FROM read_parquet('in.parquet')) TO 'out.csv' (FORMAT CSV, HEADER)",
    );
  });

  it("csv→parquet uses ZSTD compression", () => {
    expect(
      buildConversionSql({ from: "csv", to: "parquet" }, "in.csv", "out.parquet"),
    ).toBe(
      "COPY (SELECT * FROM read_csv('in.csv')) TO 'out.parquet' (FORMAT PARQUET, COMPRESSION ZSTD)",
    );
  });

  it("json output is ARRAY and jsonl output is NDJSON", () => {
    expect(
      buildConversionSql({ from: "parquet", to: "json" }, "a.parquet", "b.json"),
    ).toContain("FORMAT JSON, ARRAY true");
    expect(
      buildConversionSql({ from: "parquet", to: "jsonl" }, "a.parquet", "b.jsonl"),
    ).toMatch(/\(FORMAT JSON\)$/);
  });

  it("escapes single quotes in file names", () => {
    const sql = buildConversionSql(
      { from: "parquet", to: "csv" },
      "user's file.parquet",
      "out.csv",
    );
    expect(sql).toContain("read_parquet('user''s file.parquet')");
  });
});

describe("outputFileMeta", () => {
  it("returns the extension and MIME type", () => {
    expect(outputFileMeta("csv")).toEqual({ extension: "csv", mimeType: "text/csv" });
    expect(outputFileMeta("parquet").extension).toBe("parquet");
  });
});
