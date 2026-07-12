import { expect, it } from "vitest";

// Verifies that the browser features the engine layer relies on exist.
// The DuckDB-WASM / hyparquet integration tests build on this environment.
it("has the browser APIs required to run WASM", () => {
  expect(typeof WebAssembly).toBe("object");
  expect(typeof Worker).toBe("function");
  expect(typeof File).toBe("function");
  expect(typeof URL.createObjectURL).toBe("function");
});
