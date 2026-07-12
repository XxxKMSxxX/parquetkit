// Copy the DuckDB-WASM bundles from node_modules to public/duckdb/.
// Self-hosting for CI / vitest browser so they never depend on jsDelivr (public/duckdb is gitignored).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve("@duckdb/duckdb-wasm"));
const dest = path.resolve("public/duckdb");
mkdirSync(dest, { recursive: true });

const files = [
  "duckdb-mvp.wasm",
  "duckdb-browser-mvp.worker.js",
  "duckdb-eh.wasm",
  "duckdb-browser-eh.worker.js",
];

for (const file of files) {
  copyFileSync(path.join(dist, file), path.join(dest, file));
  console.log(`copied ${file}`);
}
