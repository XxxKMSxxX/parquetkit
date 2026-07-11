import type { BundleSource } from "@/lib/engine/duckdb/bundles";

/**
 * DuckDBバンドルの取得先を決める。通常はCDN(jsDelivr)。
 * e2eテストは `?duckdb=self` でself-hostedに切り替え、外部ネットワーク依存を排除する。
 */
export function resolveBundleSource(): BundleSource {
  if (typeof window === "undefined") return "cdn";
  const param = new URLSearchParams(window.location.search).get("duckdb");
  return param === "self" ? "self-hosted" : "cdn";
}
