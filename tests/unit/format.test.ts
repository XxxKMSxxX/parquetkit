import { describe, expect, it } from "vitest";
import { formatBytes, formatRowCount } from "@/lib/engine/format/bytes";

describe("formatBytes", () => {
  it("shows integer bytes as-is", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
  });

  it("scales up the unit", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(200 * 1024 * 1024)).toBe("200 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3.0 GB");
  });

  it("shows a hyphen for invalid values", () => {
    expect(formatBytes(-1)).toBe("-");
    expect(formatBytes(Number.NaN)).toBe("-");
  });
});

describe("formatRowCount", () => {
  it("formats with thousands separators", () => {
    expect(formatRowCount(1234567)).toBe("1,234,567");
    expect(formatRowCount(1234567890123n)).toBe("1,234,567,890,123");
  });
});
