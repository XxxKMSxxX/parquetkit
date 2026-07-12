import { describe, expect, it } from "vitest";
import { formatCell, toCsv, toJson } from "@/lib/engine/format/cell";

describe("formatCell", () => {
  it("stringifies primitives and special types", () => {
    expect(formatCell(null)).toBe("");
    expect(formatCell(undefined)).toBe("");
    expect(formatCell(42n)).toBe("42");
    expect(formatCell(1.5)).toBe("1.5");
    expect(formatCell(true)).toBe("true");
    expect(formatCell(new Date("2026-01-01T00:00:00Z"))).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("serializes nested structures to JSON, stringifying inner BigInts", () => {
    expect(formatCell({ a: 1n, b: ["x"] })).toBe('{"a":"1","b":["x"]}');
  });
});

describe("toCsv", () => {
  it("joins the header and data rows with CRLF", () => {
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

describe("toJson", () => {
  it("serializes bigint, Date and nested values safely", () => {
    const json = toJson({
      id: 9007199254740993n,
      at: new Date("2026-01-01T00:00:00Z"),
      tags: ["a", "b"],
      nested: { n: 1n },
    });
    const parsed = JSON.parse(json);
    expect(parsed.id).toBe("9007199254740993");
    expect(parsed.at).toBe("2026-01-01T00:00:00.000Z");
    expect(parsed.tags).toEqual(["a", "b"]);
    expect(parsed.nested.n).toBe("1");
  });
});
