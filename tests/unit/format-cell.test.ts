import { describe, expect, it } from "vitest";
import { formatCell, toCsv } from "@/lib/engine/format/cell";

describe("formatCell", () => {
  it("プリミティブと特殊型を文字列化する", () => {
    expect(formatCell(null)).toBe("");
    expect(formatCell(undefined)).toBe("");
    expect(formatCell(42n)).toBe("42");
    expect(formatCell(1.5)).toBe("1.5");
    expect(formatCell(true)).toBe("true");
    expect(formatCell(new Date("2026-01-01T00:00:00Z"))).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("ネスト構造はJSON化し、内部のBigIntも文字列にする", () => {
    expect(formatCell({ a: 1n, b: ["x"] })).toBe('{"a":"1","b":["x"]}');
  });
});

describe("toCsv", () => {
  it("ヘッダ+データ行をCRLFで結合する", () => {
    const csv = toCsv(
      ["id", "name"],
      [
        { id: 1n, name: "alice" },
        { id: 2n, name: 'says "hi", ok' },
      ],
    );
    expect(csv).toBe('id,name\r\n1,alice\r\n2,"says ""hi"", ok"\r\n');
  });
});
