import * as duckdb from "@duckdb/duckdb-wasm";

export type BundleSource = "cdn" | "self-hosted";

/**
 * Where DuckDB-WASM bundles are fetched from.
 * - cdn: official jsDelivr bundles. Used in production (spares Vercel's free bandwidth).
 *   Only static assets are fetched — user data is never sent anywhere.
 * - self-hosted: under /public/duckdb/. For CI / vitest browser (removes jsDelivr-induced flakes).
 *   Copied from node_modules by scripts/copy-duckdb-assets.mjs.
 */
export function getBundles(source: BundleSource): duckdb.DuckDBBundles {
  if (source === "self-hosted") {
    return {
      mvp: {
        mainModule: "/duckdb/duckdb-mvp.wasm",
        mainWorker: "/duckdb/duckdb-browser-mvp.worker.js",
      },
      eh: {
        mainModule: "/duckdb/duckdb-eh.wasm",
        mainWorker: "/duckdb/duckdb-browser-eh.worker.js",
      },
    };
  }
  return duckdb.getJsDelivrBundles();
}
