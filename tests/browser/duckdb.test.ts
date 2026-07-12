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

// Both CI and local use the self-hosted bundles (public/duckdb/) to avoid jsDelivr-induced flakes
const dbPromise = initDuckDB("self-hosted");

afterAll(async () => {
  await resetDuckDB();
});

describe("DuckDB-WASM integration", () => {
  it("runs SQL against a local Parquet file", async () => {
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

  it("renders DECIMAL values with their scale intact", async () => {
    const db = await dbPromise;
    const result = await runQuery(
      db,
      `SELECT CAST('101664.13' AS DECIMAL(18,2)) AS v,
              CAST('-5.10' AS DECIMAL(10,2)) AS neg,
              CAST('0.07' AS DECIMAL(4,2)) AS small,
              CAST('42' AS DECIMAL(10,0)) AS whole`,
    );
    expect(result.rows[0].v).toBe("101664.13");
    expect(result.rows[0].neg).toBe("-5.10");
    expect(result.rows[0].small).toBe("0.07");
    expect(result.rows[0].whole).toBe("42");
  });

  it("renders TIMESTAMP values as ISO strings", async () => {
    const db = await dbPromise;
    const result = await runQuery(
      db,
      "SELECT TIMESTAMP '2026-01-24 21:01:00' AS ts",
    );
    expect(result.rows[0].ts).toBe("2026-01-24T21:01:00.000Z");
  });

  it("csv→parquet conversion produces a valid Parquet file", async () => {
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

    // Read the output back with hyparquet (a round trip across engines)
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

  it("parquet→csv conversion output contains the header and data", async () => {
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
