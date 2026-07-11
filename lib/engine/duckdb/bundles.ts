import * as duckdb from "@duckdb/duckdb-wasm";

export type BundleSource = "cdn" | "self-hosted";

/**
 * DuckDB-WASMバンドルの取得先。
 * - cdn: jsDelivr公式バンドル。本番用(Vercelの帯域無料枠を温存する)。
 *   静的アセットの取得のみで、ユーザーデータは一切外部送信されない。
 * - self-hosted: /public/duckdb/ 配下。CI・vitest browser用(jsDelivr起因のflakeを排除)。
 *   scripts/copy-duckdb-assets.mjs でnode_modulesからコピーする。
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
