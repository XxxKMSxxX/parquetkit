import { afterAll, describe, expect, it } from "vitest";
import {
  initDuckDB,
  registerFile,
  dropFile,
  runQuery,
  runCopy,
  resetDuckDB,
} from "@/lib/engine/duckdb";
import { buildConversionSql } from "@/lib/engine/convert/jobs";
import { asyncBufferFromBlob, openParquet } from "@/lib/engine/parquet/reader";
import parquetFixtureUrl from "../fixtures/basic_snappy.parquet?url";
import csvFixtureUrl from "../fixtures/simple.csv?url";

async function fixtureFile(url: string, name: string, type = ""): Promise<File> {
  const blob = await (await fetch(url)).blob();
  return new File([blob], name, { type });
}

// CI/ローカルともself-hostedバンドル(public/duckdb/)を使いjsDelivr起因のflakeを避ける
const dbPromise = initDuckDB("self-hosted");

afterAll(async () => {
  await resetDuckDB();
});

describe("DuckDB-WASM統合", () => {
  it("ローカルParquetファイルにSQLを実行できる", async () => {
    const db = await dbPromise;
    const file = await fixtureFile(parquetFixtureUrl, "basic.parquet");
    await registerFile(db, "basic.parquet", file);

    const count = await runQuery(
      db,
      "SELECT count(*)::INTEGER AS n FROM read_parquet('basic.parquet')",
    );
    expect(count.rows[0].n).toBe(100);

    const filtered = await runQuery(
      db,
      "SELECT name, score FROM read_parquet('basic.parquet') WHERE active ORDER BY id LIMIT 3",
    );
    expect(filtered.columns).toEqual(["name", "score"]);
    expect(filtered.numRows).toBe(3);
    expect(filtered.rows[0].name).toBe("user_000");

    await dropFile(db, "basic.parquet");
  });

  it("csv→parquet変換の出力が正しいParquetになる", async () => {
    const db = await dbPromise;
    const file = await fixtureFile(csvFixtureUrl, "simple.csv", "text/csv");
    await registerFile(db, "simple.csv", file);

    const sql = buildConversionSql(
      { from: "csv", to: "parquet" },
      "simple.csv",
      "out.parquet",
    );
    const bytes = await runCopy(db, sql, "out.parquet");
    expect(bytes.byteLength).toBeGreaterThan(0);

    // 出力をhyparquetで読み戻して検証(エンジンをまたいだラウンドトリップ)
    const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer]);
    const handle = await openParquet(asyncBufferFromBlob(blob));
    expect(handle.info.numRows).toBe(100n);
    expect(handle.info.columns.map((c) => c.name)).toEqual([
      "id",
      "score",
      "name",
      "active",
    ]);

    await dropFile(db, "simple.csv");
  });

  it("parquet→csv変換の出力にヘッダとデータが含まれる", async () => {
    const db = await dbPromise;
    const file = await fixtureFile(parquetFixtureUrl, "basic2.parquet");
    await registerFile(db, "basic2.parquet", file);

    const sql = buildConversionSql(
      { from: "parquet", to: "csv" },
      "basic2.parquet",
      "out.csv",
    );
    const bytes = await runCopy(db, sql, "out.csv");
    const text = new TextDecoder().decode(bytes);
    const [header, firstRow] = text.split("\n");
    expect(header.split(",")).toContain("unicode");
    expect(firstRow).toContain("user_000");

    await dropFile(db, "basic2.parquet");
  });
});
