import type { BundleSource } from "@/lib/engine/duckdb/bundles";

/**
 * Decides where DuckDB bundles are fetched from. Default is the CDN (jsDelivr).
 * e2e tests switch to self-hosted via `?duckdb=self` to remove the external network dependency.
 */
export function resolveBundleSource(): BundleSource {
  if (typeof window === "undefined") return "cdn";
  const param = new URLSearchParams(window.location.search).get("duckdb");
  return param === "self" ? "self-hosted" : "cdn";
}
