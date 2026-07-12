"use client";

import { useCallback, useRef, useState } from "react";
import { FileDropZone } from "./FileDropZone";
import { DataTable } from "./DataTable";
import { resolveBundleSource } from "./bundle-source";
import { toCsv } from "@/lib/engine/format/cell";
import { formatBytes } from "@/lib/engine/format/bytes";
import type { QueryResult } from "@/lib/engine/duckdb";

interface RegisteredFile {
  name: string;
  size: number;
}

/** Lazily import the DuckDB module (keeps the initial bundle light) */
async function loadEngine() {
  return import("@/lib/engine/duckdb");
}

export function SqlClient() {
  const [files, setFiles] = useState<RegisteredFile[]>([]);
  const [sql, setSql] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading-engine" | "running">(
    "idle",
  );
  const [copied, setCopied] = useState(false);
  const prefetched = useRef(false);

  const prefetch = useCallback(() => {
    if (prefetched.current) return;
    prefetched.current = true;
    void loadEngine().then((engine) => engine.initDuckDB(resolveBundleSource()));
  }, []);

  const onFiles = useCallback(async (dropped: File[]) => {
    setError(null);
    setStatus("loading-engine");
    try {
      const engine = await loadEngine();
      const db = await engine.initDuckDB(resolveBundleSource());
      for (const file of dropped) {
        await engine.registerFile(db, file.name, file);
      }
      setFiles((prev) => {
        const next = [...prev];
        for (const file of dropped) {
          if (!next.some((f) => f.name === file.name)) {
            next.push({ name: file.name, size: file.size });
          }
        }
        return next;
      });
      setSql((prev) => prev || `SELECT * FROM '${dropped[0].name}' LIMIT 100`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStatus("idle");
    }
  }, []);

  const runSql = useCallback(async (statement: string) => {
    if (!statement.trim()) return;
    setError(null);
    setStatus("running");
    try {
      const engine = await loadEngine();
      const db = await engine.initDuckDB(resolveBundleSource());
      setResult(await engine.runQuery(db, statement));
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStatus("idle");
    }
  }, []);

  const run = useCallback(() => runSql(sql), [runSql, sql]);

  const SAMPLE_SQL = `SELECT country, count(*) AS orders, round(sum(total_usd), 2) AS revenue
FROM 'demo.parquet'
GROUP BY country
ORDER BY revenue DESC;`;

  const loadSample = useCallback(async () => {
    setError(null);
    setStatus("loading-engine");
    try {
      const res = await fetch("/samples/demo.parquet");
      if (!res.ok) throw new Error(`sample fetch failed (${res.status})`);
      const blob = await res.blob();
      const file = new File([blob], "demo.parquet", {
        type: "application/octet-stream",
      });
      const engine = await loadEngine();
      const db = await engine.initDuckDB(resolveBundleSource());
      await engine.registerFile(db, file.name, file);
      setFiles((prev) =>
        prev.some((f) => f.name === file.name)
          ? prev
          : [...prev, { name: file.name, size: file.size }],
      );
      setSql(SAMPLE_SQL);
      await runSql(SAMPLE_SQL);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("idle");
    }
  }, [SAMPLE_SQL, runSql]);

  const downloadCsv = useCallback(() => {
    if (!result) return;
    const blob = new Blob([toCsv(result.columns, result.rows)], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "query-result.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }, [result]);

  return (
    <div className="flex flex-col gap-6">
      <FileDropZone
        accept=".parquet,.csv,.json,.jsonl"
        label="Drop Parquet / CSV / JSON files to query"
        sublabel="Registered files can be referenced by name in SQL"
        multiple
        onFiles={onFiles}
        onInteract={prefetch}
      />
      <p className="-mt-3 text-center text-sm text-neutral-500">
        No file handy?{" "}
        <button
          type="button"
          disabled={status !== "idle"}
          onClick={loadSample}
          data-testid="sql-sample"
          className="font-medium text-sky-600 underline underline-offset-2 transition-colors hover:text-sky-500 disabled:opacity-50 dark:text-sky-400 dark:hover:text-sky-300"
        >
          Query a sample dataset
        </button>{" "}
        — 5,000 e-commerce orders, aggregated by country.
      </p>

      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-2 text-xs" data-testid="registered-files">
          {files.map((file) => (
            <li
              key={file.name}
              className="rounded-full border border-neutral-300 px-3 py-1 font-mono dark:border-neutral-700"
            >
              {file.name} · {formatBytes(file.size)}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="sql-editor" className="font-semibold">
          SQL
        </label>
        <textarea
          id="sql-editor"
          data-testid="sql-editor"
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onFocus={prefetch}
          rows={5}
          spellCheck={false}
          placeholder="SELECT * FROM 'yourfile.parquet' LIMIT 100"
          className="w-full rounded-lg border border-neutral-300 bg-white p-3 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="run-query"
            onClick={run}
            disabled={status !== "idle" || !sql.trim()}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {status === "running"
              ? "Running…"
              : status === "loading-engine"
                ? "Loading engine…"
                : "Run query"}
          </button>
          {result ? (
            <>
              <button
                type="button"
                onClick={downloadCsv}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                Download CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!result) return;
                  void navigator.clipboard
                    .writeText(toCsv(result.columns, result.rows))
                    .then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    });
                }}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                {copied ? "Copied!" : "Copy as CSV"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="font-mono text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="flex flex-col gap-2" data-testid="sql-result">
          <p className="text-sm text-neutral-500">
            {result.numRows} row{result.numRows === 1 ? "" : "s"}
          </p>
          <DataTable columns={result.columns} rows={result.rows} />
        </section>
      ) : null}
    </div>
  );
}
