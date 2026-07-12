"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileDropZone } from "./FileDropZone";
import { DataTable } from "./DataTable";
import { resolveBundleSource } from "./bundle-source";
import { takeFiles } from "./file-handoff";
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

const LAST_SQL_KEY = "parquetkit:sql:last";
// Cap DOM rendering to keep huge results responsive; downloads/copies use all rows
const RENDER_LIMIT = 1_000;

export function SqlClient() {
  const [files, setFiles] = useState<RegisteredFile[]>([]);
  // Restore the last query (this component is client-only via ssr:false)
  const [sql, setSql] = useState(() => {
    try {
      return localStorage.getItem(LAST_SQL_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading-engine" | "running">(
    "idle",
  );
  const [copied, setCopied] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const prefetched = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  /** Insert 'name' at the cursor position and restore focus */
  const insertFileName = useCallback((name: string) => {
    const quoted = `'${name}'`;
    const el = editorRef.current;
    if (!el) {
      setSql((prev) => prev + quoted);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    setSql((prev) => prev.slice(0, start) + quoted + prev.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + quoted.length;
      el.setSelectionRange(caret, caret);
    });
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(LAST_SQL_KEY, sql);
      } catch {
        // storage full / unavailable — persisting the query is best-effort only
      }
    }, 400);
    return () => clearTimeout(id);
  }, [sql]);

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
      const started = performance.now();
      const queryResult = await engine.runQuery(db, statement);
      setElapsedMs(performance.now() - started);
      setResult(queryResult);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStatus("idle");
    }
  }, []);

  // Receive files handed off from the viewer (register + prefill, no auto-run).
  // takeFiles() empties the stash, so re-runs are no-ops. Deferred to a task
  // so registration state updates happen outside the effect body.
  useEffect(() => {
    const id = setTimeout(() => {
      const stashed = takeFiles();
      if (stashed && stashed.length > 0) void onFiles(stashed);
    }, 0);
    return () => clearTimeout(id);
  }, [onFiles]);

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
              className="flex items-center gap-2 rounded-full border border-neutral-300 py-1 pl-3 pr-1 dark:border-neutral-700"
            >
              <button
                type="button"
                title="Insert into query"
                onClick={() => insertFileName(file.name)}
                className="font-mono transition-colors hover:text-sky-600 dark:hover:text-sky-400"
              >
                {file.name}
              </button>
              <span className="text-neutral-500">{formatBytes(file.size)}</span>
              <span className="flex gap-1">
                {(
                  [
                    ["Preview", `SELECT * FROM '${file.name}' LIMIT 100`],
                    ["Schema", `DESCRIBE SELECT * FROM '${file.name}'`],
                    ["Stats", `SUMMARIZE SELECT * FROM '${file.name}'`],
                  ] as const
                ).map(([label, statement]) => (
                  <button
                    key={label}
                    type="button"
                    data-testid={`chip-${label.toLowerCase()}`}
                    disabled={status !== "idle"}
                    onClick={() => {
                      setSql(statement);
                      void runSql(statement);
                    }}
                    className="rounded-full border border-neutral-200 px-2 py-0.5 transition-colors hover:border-sky-500/60 hover:text-sky-600 disabled:opacity-50 dark:border-neutral-800 dark:hover:border-sky-400/60 dark:hover:text-sky-400"
                  >
                    {label}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="sql-editor" className="font-semibold">
          SQL
        </label>
        <textarea
          ref={editorRef}
          id="sql-editor"
          data-testid="sql-editor"
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onFocus={prefetch}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void run();
            }
          }}
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
          <span className="hidden text-xs text-neutral-500 sm:inline">
            <kbd className="rounded border border-neutral-300 px-1.5 py-0.5 font-mono dark:border-neutral-700">
              ⌘⏎
            </kbd>{" "}
            to run
          </span>
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
            {result.numRows} row{result.numRows === 1 ? "" : "s"} ·{" "}
            {result.columns.length} column
            {result.columns.length === 1 ? "" : "s"}
            {elapsedMs !== null ? ` · ${Math.max(1, Math.round(elapsedMs))} ms` : null}
          </p>
          {result.rows.length > RENDER_LIMIT ? (
            <p className="text-sm text-neutral-500">
              Showing the first {RENDER_LIMIT.toLocaleString()} of{" "}
              {result.numRows.toLocaleString()} rows — use Download CSV for the
              full result.
            </p>
          ) : null}
          <DataTable
            columns={result.columns}
            rows={result.rows.slice(0, RENDER_LIMIT)}
          />
        </section>
      ) : null}
    </div>
  );
}
