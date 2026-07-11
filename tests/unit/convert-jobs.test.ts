import { describe, expect, it } from "vitest";
import {
  SUPPORTED_CONVERSIONS,
  buildConversionSql,
  conversionSlug,
  outputFileMeta,
  parseConversionSlug,
} from "@/lib/engine/convert/jobs";

describe("conversionSlug / parseConversionSlug", () => {
  it("全サポートペアがslugと相互変換できる", () => {
    for (const pair of SUPPORTED_CONVERSIONS) {
      expect(parseConversionSlug(conversionSlug(pair))).toEqual(pair);
    }
  });

  it("未サポートのslugはnull", () => {
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

  it("csv→parquet はZSTD圧縮", () => {
    expect(
      buildConversionSql({ from: "csv", to: "parquet" }, "in.csv", "out.parquet"),
    ).toBe(
      "COPY (SELECT * FROM read_csv('in.csv')) TO 'out.parquet' (FORMAT PARQUET, COMPRESSION ZSTD)",
    );
  });

  it("json出力はARRAY、jsonl出力はNDJSON", () => {
    expect(
      buildConversionSql({ from: "parquet", to: "json" }, "a.parquet", "b.json"),
    ).toContain("FORMAT JSON, ARRAY true");
    expect(
      buildConversionSql({ from: "parquet", to: "jsonl" }, "a.parquet", "b.jsonl"),
    ).toMatch(/\(FORMAT JSON\)$/);
  });

  it("ファイル名のシングルクォートをエスケープする", () => {
    const sql = buildConversionSql(
      { from: "parquet", to: "csv" },
      "user's file.parquet",
      "out.csv",
    );
    expect(sql).toContain("read_parquet('user''s file.parquet')");
  });
});

describe("outputFileMeta", () => {
  it("拡張子とMIMEタイプを返す", () => {
    expect(outputFileMeta("csv")).toEqual({ extension: "csv", mimeType: "text/csv" });
    expect(outputFileMeta("parquet").extension).toBe("parquet");
  });
});
