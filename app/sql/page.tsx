import type { Metadata } from "next";
import { SqlTool } from "@/components/tool/loaders";

export const metadata: Metadata = {
  title: "SQL Workbench — Query Parquet & CSV Files in Your Browser",
  description:
    "Run SQL queries against local Parquet, CSV and JSON files with DuckDB WebAssembly. Everything stays on your device — no upload, no signup.",
};

export default function SqlWorkbenchPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">SQL Workbench</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Query local Parquet, CSV and JSON files with real SQL, powered by
          DuckDB compiled to WebAssembly. Join files, aggregate columns and
          export results — without your data ever leaving the browser.
        </p>
      </header>

      <SqlTool />

      <section className="flex flex-col gap-3 border-t border-neutral-200 pt-8 dark:border-neutral-800">
        <h2 className="text-xl font-semibold">How it works</h2>
        <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
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
      </section>
    </main>
  );
}
