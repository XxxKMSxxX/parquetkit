import { expect, it } from "vitest";

// エンジン層が前提とするブラウザ機能の存在確認。
// P1でDuckDB-WASM/hyparquetの統合テストがここに追加される。
it("WASM実行に必要なブラウザAPIが存在する", () => {
  expect(typeof WebAssembly).toBe("object");
  expect(typeof Worker).toBe("function");
  expect(typeof File).toBe("function");
  expect(typeof URL.createObjectURL).toBe("function");
});
