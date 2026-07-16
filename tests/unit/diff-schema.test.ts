import { describe, expect, it } from "vitest";
import { diffSchemas, guessKeyColumns } from "@/lib/engine/diff/schema";
import type { ColumnInfo } from "@/lib/engine/parquet/reader";

function column(name: string, type = "INT64", logicalType: string | null = null): ColumnInfo {
  return { name, type, logicalType };
}

describe("diffSchemas", () => {
  it("identical schemas produce an empty diff", () => {
    const columns = [column("id"), column("name", "BYTE_ARRAY", "STRING")];
    const diff = diffSchemas(columns, columns);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.typeChanged).toEqual([]);
    expect(diff.common).toEqual(["id", "name"]);
    expect(diff.identical).toBe(true);
  });

  it("detects added, removed, and type-changed columns", () => {
    const left = [column("id"), column("score", "DOUBLE"), column("nullable", "BYTE_ARRAY", "STRING")];
    const right = [column("id"), column("score", "INT64"), column("region", "BYTE_ARRAY", "STRING")];
    const diff = diffSchemas(left, right);

    expect(diff.added.map((c) => c.name)).toEqual(["region"]);
    expect(diff.removed.map((c) => c.name)).toEqual(["nullable"]);
    expect(diff.typeChanged).toEqual([
      {
        name: "score",
        leftType: "DOUBLE",
        leftLogicalType: null,
        rightType: "INT64",
        rightLogicalType: null,
      },
    ]);
    expect(diff.common).toEqual(["id", "score"]);
    expect(diff.identical).toBe(false);
  });

  it("treats a logical-type change as a type change", () => {
    const left = [column("ts", "INT64", "TIMESTAMP")];
    const right = [column("ts", "INT64", null)];
    expect(diffSchemas(left, right).typeChanged).toHaveLength(1);
  });
});

describe("guessKeyColumns", () => {
  it("prefers an exact id column", () => {
    expect(guessKeyColumns(["name", "id", "user_id"])).toEqual(["id"]);
    expect(guessKeyColumns(["name", "ID"])).toEqual(["ID"]);
  });

  it("falls back to *_id columns", () => {
    expect(guessKeyColumns(["name", "user_id"])).toEqual(["user_id"]);
  });

  it("returns empty when nothing looks like a key", () => {
    expect(guessKeyColumns(["name", "score"])).toEqual([]);
    expect(guessKeyColumns([])).toEqual([]);
  });
});
