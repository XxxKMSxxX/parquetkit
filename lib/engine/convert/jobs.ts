export const DATA_FORMATS = ["parquet", "csv", "json", "jsonl"] as const;
export type DataFormat = (typeof DATA_FORMATS)[number];

export interface ConversionPair {
  from: DataFormat;
  to: DataFormat;
}

/** サポートする変換ペア。convert/[slug] ページと1:1対応する。 */
export const SUPPORTED_CONVERSIONS: readonly ConversionPair[] = [
  { from: "parquet", to: "csv" },
  { from: "parquet", to: "json" },
  { from: "parquet", to: "jsonl" },
  { from: "csv", to: "parquet" },
  { from: "jsonl", to: "parquet" },
] as const;

export function conversionSlug(pair: ConversionPair): string {
  return `${pair.from}-to-${pair.to}`;
}

export function parseConversionSlug(slug: string): ConversionPair | null {
  const match = SUPPORTED_CONVERSIONS.find((pair) => conversionSlug(pair) === slug);
  return match ?? null;
}

/** DuckDBのSQL文字列リテラル用エスケープ。 */
function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/** 入力ファイルを読むテーブル関数式を生成する。 */
export function buildReadExpression(format: DataFormat, fileName: string): string {
  const file = quoteLiteral(fileName);
  switch (format) {
    case "parquet":
      return `read_parquet(${file})`;
    case "csv":
      return `read_csv(${file})`;
    case "json":
    case "jsonl":
      return `read_json(${file})`;
  }
}

/** 出力フォーマットのCOPYオプションを生成する。 */
export function buildCopyOptions(to: DataFormat): string {
  switch (to) {
    case "csv":
      return "FORMAT CSV, HEADER";
    case "json":
      // JSON配列として出力(jsonlとの違い)
      return "FORMAT JSON, ARRAY true";
    case "jsonl":
      return "FORMAT JSON";
    case "parquet":
      return "FORMAT PARQUET, COMPRESSION ZSTD";
  }
}

/** 変換ジョブ全体のCOPY文を生成する。 */
export function buildConversionSql(
  pair: ConversionPair,
  inputFileName: string,
  outputFileName: string,
): string {
  const read = buildReadExpression(pair.from, inputFileName);
  const options = buildCopyOptions(pair.to);
  return `COPY (SELECT * FROM ${read}) TO ${quoteLiteral(outputFileName)} (${options})`;
}

/** 出力ファイルの拡張子とMIMEタイプ。ダウンロード時に使用する。 */
export function outputFileMeta(to: DataFormat): { extension: string; mimeType: string } {
  switch (to) {
    case "csv":
      return { extension: "csv", mimeType: "text/csv" };
    case "json":
      return { extension: "json", mimeType: "application/json" };
    case "jsonl":
      return { extension: "jsonl", mimeType: "application/x-ndjson" };
    case "parquet":
      return { extension: "parquet", mimeType: "application/vnd.apache.parquet" };
  }
}
