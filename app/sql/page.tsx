import type { Metadata } from "next";
import { SqlTool } from "@/components/tool/loaders";

export const metadata: Metadata = {
  title: "SQL Workbench — Query Parquet & CSV Files in Your Browser",
  description:
    "Run SQL queries against local Parquet, CSV and JSON files with DuckDB WebAssembly. Everything stays on your device — no upload, no signup.",
};

export default function SqlWorkbenchPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">SQL Workbench</h1>
        <div className="flex flex-col text-neutral-600 dark:text-neutral-400">
          <p>
            Query local Parquet, CSV and JSON files with real SQL, powered by
            DuckDB compiled to WebAssembly.
          </p>
          <p>
            Join files, aggregate columns and export results — without your
            data ever leaving the browser.
          </p>
        </div>
      </header>

      <SqlTool />

      <section className="grid gap-8 border-t border-neutral-200 pt-8 lg:grid-cols-2 dark:border-neutral-800">
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">How it works</h2>
          <p className="text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
          The workbench runs{" "}
          <a className="underline" href="https://duckdb.org/docs/api/wasm/overview" rel="noopener">
            DuckDB-WASM
          </a>{" "}
          inside a Web Worker in your browser. Dropped files are registered
          with DuckDB by reference — they are read on demand, not copied — and
          you can query them by filename:{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs dark:bg-neutral-900">
            SELECT * FROM &apos;sales.parquet&apos; JOIN &apos;users.csv&apos; USING (id)
          </code>
          . The full DuckDB SQL dialect is available, including window
          functions, aggregates and JSON functions.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Tips &amp; shortcuts</h2>
          <ul className="flex flex-col gap-2 text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
            <li>
              Press{" "}
              <kbd className="rounded border border-neutral-300 px-1.5 py-0.5 font-mono text-xs dark:border-neutral-700">
                ⌘ Enter
              </kbd>{" "}
              (or Ctrl+Enter) to run the query.
            </li>
            <li>
              Click a registered file&apos;s name to insert it at the cursor,
              or use its <em>Preview</em> / <em>Schema</em> / <em>Stats</em>{" "}
              buttons for instant one-click queries.
            </li>
            <li>
              Join across formats freely — e.g.{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs dark:bg-neutral-900">
                SELECT * FROM &apos;a.parquet&apos; JOIN &apos;b.csv&apos; USING (id)
              </code>
            </li>
            <li>Your last query is restored when you come back.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
