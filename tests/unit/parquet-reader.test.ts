import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AsyncBuffer } from "hyparquet";
import { openParquet, readRows } from "@/lib/engine/parquet/reader";

const FIXTURES = path.resolve(__dirname, "../fixtures");

function asyncBufferFromFixture(name: string): AsyncBuffer {
  const buf = readFileSync(path.join(FIXTURES, name));
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return {
    byteLength: arrayBuffer.byteLength,
    slice: (start, end) => arrayBuffer.slice(start, end),
  };
}

describe("openParquet", () => {
  it("スキーマとメタデータを要約する", async () => {
    const handle = await openParquet(asyncBufferFromFixture("basic_snappy.parquet"));
    expect(handle.info.numRows).toBe(100n);
    expect(handle.info.numRowGroups).toBe(1);
    expect(handle.info.numColumns).toBe(11);
    expect(handle.info.compressions).toContain("SNAPPY");
    const names = handle.info.columns.map((c) => c.name);
    expect(names).toEqual([
      "id",
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
    ]);
  });

  it.each(["snappy", "gzip", "zstd", "lz4", "none"])(
    "%s圧縮のファイルを読める",
    async (codec) => {
      const handle = await openParquet(asyncBufferFromFixture(`basic_${codec}.parquet`));
      const rows = await readRows(handle, 0, 3);
      expect(rows).toHaveLength(3);
      expect(rows[0].id).toBe(0n);
      expect(rows[0].name).toBe("user_000");
      expect(rows[2].unicode).toBe("日本語_2_🦆");
    },
  );

  it("複数row groupのファイルで行範囲を読める", async () => {
    const handle = await openParquet(asyncBufferFromFixture("multi_rowgroup.parquet"));
    expect(handle.info.numRows).toBe(5000n);
    expect(handle.info.numRowGroups).toBe(5);
    const rows = await readRows(handle, 2500, 2503);
    expect(rows).toHaveLength(3);
  });

  it("空ファイルを開ける", async () => {
    const handle = await openParquet(asyncBufferFromFixture("empty.parquet"));
    expect(handle.info.numRows).toBe(0n);
  });

  it("null・ネスト型を正しく返す", async () => {
    const handle = await openParquet(asyncBufferFromFixture("basic_snappy.parquet"));
    const rows = await readRows(handle, 0, 8);
    expect(rows[0].nullable).toBeNull();
    expect(rows[1].nullable).toBe("val_1");
    expect(rows[0].tags).toEqual(["tag0", "tag0"]);
    expect(rows[0].meta).toEqual({ lang: "en", level: 0 });
  });
});
