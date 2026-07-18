import { loadConversions, loadDocs } from "@/lib/content/loader";

export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** llms.txt (llmstxt.org) index of the site, regenerated on every build (weekly agent included). */
export function GET(): Response {
  const conversions = loadConversions()
    .map(
      ({ meta }) =>
        `- [${meta.title}](${SITE}/convert/${meta.slug}): ${meta.description}`,
    )
    .join("\n");

  const docs = loadDocs()
    .map(
      ({ meta }) =>
        `- [${meta.title}](${SITE}/docs/${meta.slug}): ${meta.description}`,
    )
    .join("\n");

  const text = `# ParquetKit

> Free browser-based toolkit for Apache Parquet files: viewer, SQL workbench, converters and diff. All processing runs locally via WebAssembly (hyparquet + DuckDB) — files are never uploaded, no signup required.

## Tools

- [Parquet Viewer](${SITE}/parquet-viewer): Free online Parquet file viewer. Inspect schema, metadata and rows locally in your browser. No upload, no signup — your data never leaves your device.
- [SQL Workbench](${SITE}/sql): Run SQL queries against local Parquet, CSV and JSON files with DuckDB WebAssembly. Everything stays on your device — no upload, no signup.
- [Parquet Diff](${SITE}/diff): Free online Parquet diff. Compare two Parquet files by key and see added, removed and changed rows plus schema changes — locally in your browser, nothing uploaded.
- [Guides](${SITE}/docs): Practical guides on opening, querying and converting Parquet files — no Spark, no installs, everything in the browser.

## Converters

${conversions}

## Guides

${docs}

## Optional

- [Full guide contents](${SITE}/llms-full.txt): All guides and converter pages as a single plain-text file.
`;
  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
