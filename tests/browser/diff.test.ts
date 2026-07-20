import { afterAll, describe, expect, it } from "vitest";
import { initDuckDB, resetDuckDB } from "@/lib/engine/duckdb";
import {
  checkKeyUniqueness,
  diffSchemas,
  dropDiffInputs,
  fetchAllDiffRows,
  fetchDiffRows,
  fetchDiffSummary,
  registerDiffInputs,
} from "@/lib/engine/diff";
import { asyncBufferFromBlob, openParquet } from "@/lib/engine/parquet/reader";
import diffLeftUrl from "../fixtures/diff_left.parquet?url";
import diffRightUrl from "../fixtures/diff_right.parquet?url";
import diffSchemaRightUrl from "../fixtures/diff_schema_right.parquet?url";
import diffNokeyLeftUrl from "../fixtures/diff_nokey_left.parquet?url";
import diffNokeyRightUrl from "../fixtures/diff_nokey_right.parquet?url";

async function fixtureFile(url: string, name: string): Promise<File> {
  const blob = await (await fetch(url)).blob();
  return new File([blob], name);
}

// Both CI and local use the self-hosted bundles (public/duckdb/) to avoid jsDelivr-induced flakes
const dbPromise = initDuckDB("self-hosted");

// The fixture pair encodes: 3 added, 2 removed, 4 changed, 94 unchanged (see
// scripts/generate_fixtures.py), joined on `id`. Non-key columns cover lists,
// structs, decimals, and timestamps, so IS DISTINCT FROM runs on nested types.
const COMPARE_COLUMNS = [
  "score",
  "name",
  "active",
  "created_at",
  "birthday",
  "balance",
  "tags",
  "meta",
  "nullable",
  "unicode",
];

afterAll(async () => {
  await resetDuckDB();
});

describe("Parquet diff engine", () => {
  it("counts added/removed/changed/unchanged rows across the fixture pair", async () => {
    const db = await dbPromise;
    const inputs = await registerDiffInputs(
      db,
      await fixtureFile(diffLeftUrl, "left.parquet"),
      await fixtureFile(diffRightUrl, "right.parquet"),
    );

    const summary = await fetchDiffSummary(db, inputs, {
      keys: ["id"],
      compareColumns: COMPARE_COLUMNS,
    });
    expect(summary).toEqual({ added: 3, removed: 2, changed: 4, unchanged: 94 });

    await dropDiffInputs(db, inputs);
  });

  it("pages detail rows per status and renders changed cells as old → new", async () => {
    const db = await dbPromise;
    const inputs = await registerDiffInputs(
      db,
      await fixtureFile(diffLeftUrl, "left.parquet"),
      await fixtureFile(diffRightUrl, "right.parquet"),
    );
    const params = { keys: ["id"], compareColumns: COMPARE_COLUMNS };

    const added = await fetchDiffRows(db, inputs, {
      ...params,
      status: "added",
      limit: 10,
      offset: 0,
    });
    expect(added.numRows).toBe(3);
    expect(added.rows.map((row) => Number(row.id))).toEqual([100, 101, 102]);

    const removed = await fetchDiffRows(db, inputs, {
      ...params,
      status: "removed",
      limit: 10,
      offset: 0,
    });
    expect(removed.rows.map((row) => Number(row.id))).toEqual([10, 20]);

    const changed = await fetchDiffRows(db, inputs, {
      ...params,
      status: "changed",
      limit: 10,
      offset: 0,
    });
    expect(changed.rows.map((row) => Number(row.id))).toEqual([1, 3, 5, 7]);
    const first = changed.rows[0];
    // id=1: score changed (0.5 → 1000.5), name unchanged → NULL cell
    expect(first.score).toBe("0.5 → 1000.5");
    expect(first.name).toBeNull();
    const renamed = changed.rows[1];
    expect(renamed.name).toBe("user_003 → renamed_003");

    const paged = await fetchDiffRows(db, inputs, {
      ...params,
      status: "changed",
      limit: 2,
      offset: 2,
    });
    expect(paged.rows.map((row) => Number(row.id))).toEqual([5, 7]);

    await dropDiffInputs(db, inputs);
  });

  it("fetchAllDiffRows returns every row per status, unpaged", async () => {
    const db = await dbPromise;
    const inputs = await registerDiffInputs(
      db,
      await fixtureFile(diffLeftUrl, "left.parquet"),
      await fixtureFile(diffRightUrl, "right.parquet"),
    );
    const params = { keys: ["id"], compareColumns: COMPARE_COLUMNS };

    const report = await fetchAllDiffRows(db, inputs, params);
    expect(report.added.rows).toHaveLength(3);
    expect(report.removed.rows).toHaveLength(2);
    expect(report.changed.rows).toHaveLength(4);
    expect(report.truncated).toBe(false);

    await dropDiffInputs(db, inputs);
  });

  it("flags duplicate keys via the uniqueness check", async () => {
    const db = await dbPromise;
    const inputs = await registerDiffInputs(
      db,
      await fixtureFile(diffNokeyLeftUrl, "nk_left.parquet"),
      await fixtureFile(diffNokeyRightUrl, "nk_right.parquet"),
    );

    const left = await checkKeyUniqueness(db, inputs.oldFileName, ["id"]);
    expect(left).toEqual({ totalRows: 4, distinctRows: 3, unique: false });

    const right = await checkKeyUniqueness(db, inputs.newFileName, ["id"]);
    expect(right.unique).toBe(false);

    await dropDiffInputs(db, inputs);
  });

  it("schema diff via hyparquet spots added/removed/type-changed columns", async () => {
    const [leftFile, rightFile] = await Promise.all([
      fixtureFile(diffLeftUrl, "left.parquet"),
      fixtureFile(diffSchemaRightUrl, "schema_right.parquet"),
    ]);
    const [left, right] = await Promise.all([
      openParquet(asyncBufferFromBlob(leftFile)),
      openParquet(asyncBufferFromBlob(rightFile)),
    ]);

    const diff = diffSchemas(left.info.columns, right.info.columns);
    expect(diff.added.map((c) => c.name)).toEqual(["region"]);
    expect(diff.removed.map((c) => c.name)).toEqual(["nullable"]);
    expect(diff.typeChanged.map((c) => c.name)).toEqual(["score"]);
    expect(diff.identical).toBe(false);
  });

  it("casts mismatched key types to VARCHAR when requested", async () => {
    const db = await dbPromise;
    const inputs = await registerDiffInputs(
      db,
      await fixtureFile(diffLeftUrl, "left.parquet"),
      await fixtureFile(diffSchemaRightUrl, "schema_right.parquet"),
    );

    // score is float64 on the left and int64 on the right; join on it as text.
    const summary = await fetchDiffSummary(db, inputs, {
      keys: ["id"],
      compareColumns: ["name"],
      castKeys: true,
    });
    expect(summary.added + summary.removed + summary.changed + summary.unchanged).toBeGreaterThan(
      0,
    );

    await dropDiffInputs(db, inputs);
  });
});
