"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileDropZone } from "./FileDropZone";
import { DataTable } from "./DataTable";
import { resolveBundleSource } from "./bundle-source";
import { formatBytes } from "@/lib/engine/format/bytes";
import {
  asyncBufferFromBlob,
  openParquet,
  type ColumnInfo,
} from "@/lib/engine/parquet/reader";
import {
  diffSchemas,
  guessKeyColumns,
  type DiffInputs,
  type DiffRowStatus,
  type DiffSummary,
  type SchemaDiff,
} from "@/lib/engine/diff";
import type { QueryResult } from "@/lib/engine/duckdb";

const PAGE_SIZE = 50;

// The heavy join runs inside DuckDB's own Web Worker — never blocks the main thread
async function loadEngine() {
  return import("@/lib/engine/duckdb");
}

async function loadDiffEngine() {
  return import("@/lib/engine/diff");
}

interface LoadedFile {
  file: File;
  columns: ColumnInfo[];
}

type Status = "idle" | "reading-schema" | "ready" | "loading-engine" | "diffing" | "done";

const TABS: { status: DiffRowStatus; label: string; accent: string }[] = [
  { status: "added", label: "Added", accent: "text-green-700 dark:text-green-400" },
  { status: "removed", label: "Removed", accent: "text-red-700 dark:text-red-400" },
  { status: "changed", label: "Changed", accent: "text-sky-700 dark:text-sky-400" },
];

export function DiffClient() {
  const [oldSide, setOldSide] = useState<LoadedFile | null>(null);
  const [newSide, setNewSide] = useState<LoadedFile | null>(null);
  const [schemaDiff, setSchemaDiff] = useState<SchemaDiff | null>(null);
  const [key, setKey] = useState<string>("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [keyWarning, setKeyWarning] = useState<string | null>(null);
  const [summary, setSummary] = useState<DiffSummary | null>(null);
  const [activeTab, setActiveTab] = useState<DiffRowStatus>("added");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<QueryResult | null>(null);
  const inputsRef = useRef<DiffInputs | null>(null);
  const prefetched = useRef(false);

  const prefetch = useCallback(() => {
    if (prefetched.current) return;
    prefetched.current = true;
    void loadEngine().then((engine) => engine.initDuckDB(resolveBundleSource()));
  }, []);

  // Drop registered inputs when the tool unmounts
  useEffect(() => {
    return () => {
      const inputs = inputsRef.current;
      if (!inputs) return;
      void loadEngine().then(async (engine) => {
        const diff = await loadDiffEngine();
        const db = await engine.initDuckDB(resolveBundleSource());
        await diff.dropDiffInputs(db, inputs);
      });
    };
  }, []);

  const resetResults = useCallback(() => {
    setSummary(null);
    setRows(null);
    setPage(0);
    setKeyWarning(null);
    setError(null);
  }, []);

  const onFiles = useCallback(
    async (files: File[]) => {
      resetResults();
      setStatus("reading-schema");
      try {
        const loaded: LoadedFile[] = [];
        for (const file of files.slice(0, 2)) {
          const handle = await openParquet(asyncBufferFromBlob(file));
          loaded.push({ file, columns: handle.info.columns });
        }

        let nextOld = oldSide;
        let nextNew = newSide;
        if (loaded.length >= 2) {
          [nextOld, nextNew] = [loaded[0], loaded[1]];
        } else if (loaded.length === 1) {
          if (!nextOld) nextOld = loaded[0];
          else nextNew = loaded[0];
        }
        setOldSide(nextOld);
        setNewSide(nextNew);

        if (nextOld && nextNew) {
          const diff = diffSchemas(nextOld.columns, nextNew.columns);
          setSchemaDiff(diff);
          if (diff.common.length === 0) {
            setStatus("idle");
            setError("The two files share no columns, so there is nothing to join on.");
            return;
          }
          const guessed = guessKeyColumns(diff.common);
          setKey(guessed[0] ?? diff.common[0]);
          setStatus("ready");
        } else {
          setSchemaDiff(null);
          setStatus("idle");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("idle");
      }
    },
    [newSide, oldSide, resetResults],
  );

  const swapSides = useCallback(() => {
    setOldSide(newSide);
    setNewSide(oldSide);
    if (oldSide && newSide) setSchemaDiff(diffSchemas(newSide.columns, oldSide.columns));
    resetResults();
    if (oldSide && newSide) setStatus("ready");
  }, [newSide, oldSide, resetResults]);

  const clearFiles = useCallback(() => {
    setOldSide(null);
    setNewSide(null);
    setSchemaDiff(null);
    setKey("");
    setStatus("idle");
    resetResults();
  }, [resetResults]);

  const diffParams = useCallback(() => {
    if (!schemaDiff) return null;
    const compareColumns = schemaDiff.common.filter((name) => name !== key);
    const castKeys = schemaDiff.typeChanged.some((change) => change.name === key);
    return { keys: [key], compareColumns, castKeys };
  }, [key, schemaDiff]);

  const loadRows = useCallback(
    async (tab: DiffRowStatus, nextPage: number) => {
      const params = diffParams();
      const inputs = inputsRef.current;
      if (!params || !inputs) return;
      try {
        const [engine, diff] = await Promise.all([loadEngine(), loadDiffEngine()]);
        const db = await engine.initDuckDB(resolveBundleSource());
        const result = await diff.fetchDiffRows(db, inputs, {
          ...params,
          status: tab,
          limit: PAGE_SIZE,
          offset: nextPage * PAGE_SIZE,
        });
        setRows(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [diffParams],
  );

  const runDiff = useCallback(async () => {
    const params = diffParams();
    if (!oldSide || !newSide || !params) return;
    resetResults();
    setStatus("loading-engine");
    try {
      const [engine, diff] = await Promise.all([loadEngine(), loadDiffEngine()]);
      const db = await engine.initDuckDB(resolveBundleSource());
      setStatus("diffing");

      if (inputsRef.current) await diff.dropDiffInputs(db, inputsRef.current);
      const inputs = await diff.registerDiffInputs(db, oldSide.file, newSide.file);
      inputsRef.current = inputs;

      const [oldKeys, newKeys] = await Promise.all([
        diff.checkKeyUniqueness(db, inputs.oldFileName, params.keys),
        diff.checkKeyUniqueness(db, inputs.newFileName, params.keys),
      ]);
      if (!oldKeys.unique || !newKeys.unique) {
        const side = !oldKeys.unique ? "old" : "new";
        const check = !oldKeys.unique ? oldKeys : newKeys;
        setKeyWarning(
          `"${key}" is not unique in the ${side} file (${check.totalRows.toLocaleString()} rows, ` +
            `${check.distinctRows.toLocaleString()} distinct values). Duplicate keys join ` +
            `many-to-many, so the counts below may be inflated — pick a different key if you can.`,
        );
      }

      const result = await diff.fetchDiffSummary(db, inputs, params);
      setSummary(result);
      setStatus("done");

      const firstTab =
        TABS.find((tab) => result[tab.status] > 0)?.status ?? "added";
      setActiveTab(firstTab);
      setPage(0);
      await loadRows(firstTab, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("ready");
    }
  }, [diffParams, key, loadRows, newSide, oldSide, resetResults]);

  const changeTab = useCallback(
    async (tab: DiffRowStatus) => {
      setActiveTab(tab);
      setPage(0);
      setRows(null);
      await loadRows(tab, 0);
    },
    [loadRows],
  );

  const changePage = useCallback(
    async (nextPage: number) => {
      setPage(nextPage);
      await loadRows(activeTab, nextPage);
    },
    [activeTab, loadRows],
  );

  const bothLoaded = Boolean(oldSide && newSide);
  const activeCount = summary ? summary[activeTab] : 0;
  const hasNext = summary ? (page + 1) * PAGE_SIZE < activeCount : false;

  return (
    <div className="flex flex-col gap-4">
      <FileDropZone
        accept=".parquet"
        multiple
        label={
          !bothLoaded
            ? oldSide || newSide
              ? "Drop the second Parquet file (the new version)"
              : "Drop two Parquet files to compare (old and new)"
            : status === "loading-engine"
              ? "Loading comparison engine…"
              : status === "diffing"
                ? "Comparing…"
                : "Drop two new files to start over"
        }
        sublabel="Select both files at once, or add them one at a time"
        onFiles={onFiles}
        onInteract={prefetch}
      />

      <p className="-mt-1 text-center text-sm text-neutral-500">
        No files handy?{" "}
        <button
          type="button"
          disabled={status === "loading-engine" || status === "diffing"}
          data-testid="diff-sample"
          onClick={async () => {
            setError(null);
            try {
              const [oldRes, newRes] = await Promise.all([
                fetch("/samples/diff-old.parquet"),
                fetch("/samples/diff-new.parquet"),
              ]);
              if (!oldRes.ok || !newRes.ok) throw new Error("sample fetch failed");
              const [oldBlob, newBlob] = await Promise.all([oldRes.blob(), newRes.blob()]);
              clearFiles();
              await onFiles([
                new File([oldBlob], "orders_v1.parquet"),
                new File([newBlob], "orders_v2.parquet"),
              ]);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
          className="font-medium text-sky-600 underline underline-offset-2 transition-colors hover:text-sky-500 disabled:opacity-50 dark:text-sky-400 dark:hover:text-sky-300"
        >
          Compare two sample files
        </button>
      </p>

      {oldSide || newSide ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800"
          data-testid="diff-files"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="truncate">
              <span className="mr-2 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-500 dark:bg-neutral-900">
                OLD
              </span>
              {oldSide ? (
                <span className="font-mono text-xs">
                  {oldSide.file.name}{" "}
                  <span className="text-neutral-500">({formatBytes(oldSide.file.size)})</span>
                </span>
              ) : (
                <span className="text-neutral-400">waiting for a file…</span>
              )}
            </p>
            <p className="truncate">
              <span className="mr-2 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-500 dark:bg-neutral-900">
                NEW
              </span>
              {newSide ? (
                <span className="font-mono text-xs">
                  {newSide.file.name}{" "}
                  <span className="text-neutral-500">({formatBytes(newSide.file.size)})</span>
                </span>
              ) : (
                <span className="text-neutral-400">waiting for a file…</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={swapSides}
              disabled={!bothLoaded}
              data-testid="diff-swap"
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:border-sky-500 disabled:opacity-40 dark:border-neutral-700"
            >
              Swap
            </button>
            <button
              type="button"
              onClick={clearFiles}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:border-sky-500 dark:border-neutral-700"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {schemaDiff ? (
        <div
          className="flex flex-col gap-2 rounded-lg border border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800"
          data-testid="diff-schema"
        >
          <h2 className="font-semibold">Schema</h2>
          {schemaDiff.identical ? (
            <p className="text-neutral-600 dark:text-neutral-400">
              Schemas are identical ({schemaDiff.common.length} columns).
            </p>
          ) : (
            <ul className="flex flex-col gap-1 font-mono text-xs">
              {schemaDiff.added.map((column) => (
                <li key={`a-${column.name}`} className="text-green-700 dark:text-green-400">
                  + {column.name} ({column.logicalType ?? column.type}) — only in new file
                </li>
              ))}
              {schemaDiff.removed.map((column) => (
                <li key={`r-${column.name}`} className="text-red-700 dark:text-red-400">
                  − {column.name} ({column.logicalType ?? column.type}) — only in old file
                </li>
              ))}
              {schemaDiff.typeChanged.map((change) => (
                <li key={`t-${change.name}`} className="text-sky-700 dark:text-sky-400">
                  ~ {change.name}: {change.leftLogicalType ?? change.leftType} →{" "}
                  {change.rightLogicalType ?? change.rightType}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-neutral-600 dark:text-neutral-400">Join key</span>
              <select
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  resetResults();
                }}
                data-testid="diff-key-select"
                className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
              >
                {schemaDiff.common.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={runDiff}
              disabled={status === "loading-engine" || status === "diffing"}
              data-testid="run-diff"
              className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
            >
              {status === "loading-engine"
                ? "Loading engine…"
                : status === "diffing"
                  ? "Comparing…"
                  : "Compare rows"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="font-mono text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {keyWarning ? (
        <p
          role="alert"
          data-testid="diff-key-warning"
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        >
          {keyWarning}
        </p>
      ) : null}

      {summary ? (
        <div className="flex flex-col gap-3">
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            data-testid="diff-summary"
          >
            {(
              [
                { label: "Added", value: summary.added, tone: "text-green-700 dark:text-green-400" },
                { label: "Removed", value: summary.removed, tone: "text-red-700 dark:text-red-400" },
                { label: "Changed", value: summary.changed, tone: "text-sky-700 dark:text-sky-400" },
                { label: "Unchanged", value: summary.unchanged, tone: "text-neutral-500" },
              ] as const
            ).map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-800"
              >
                <p className="text-xs text-neutral-500">{stat.label}</p>
                <p className={`font-mono text-xl font-semibold ${stat.tone}`}>
                  {stat.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800">
            {TABS.map((tab) => (
              <button
                key={tab.status}
                type="button"
                onClick={() => changeTab(tab.status)}
                data-testid={`diff-tab-${tab.status}`}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.status
                    ? `border-sky-500 ${tab.accent}`
                    : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                {tab.label} ({summary[tab.status].toLocaleString()})
              </button>
            ))}
          </div>

          <div data-testid="diff-rows" className="flex flex-col gap-3">
            {activeCount === 0 ? (
              <p className="py-4 text-center text-sm text-neutral-500">
                No {activeTab} rows.
              </p>
            ) : rows ? (
              <>
                {activeTab === "changed" ? (
                  <p className="text-xs text-neutral-500">
                    Only cells that changed are shown, as old → new. Empty cells are unchanged.
                  </p>
                ) : null}
                <DataTable columns={rows.columns} rows={rows.rows} offset={page * PAGE_SIZE} />
                {activeCount > PAGE_SIZE ? (
                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => changePage(page - 1)}
                      disabled={page === 0}
                      className="rounded-md border border-neutral-300 px-3 py-1.5 font-medium hover:border-sky-500 disabled:opacity-40 dark:border-neutral-700"
                    >
                      Previous
                    </button>
                    <p className="text-neutral-500">
                      {(page * PAGE_SIZE + 1).toLocaleString()}–
                      {Math.min((page + 1) * PAGE_SIZE, activeCount).toLocaleString()} of{" "}
                      {activeCount.toLocaleString()}
                    </p>
                    <button
                      type="button"
                      onClick={() => changePage(page + 1)}
                      disabled={!hasNext}
                      className="rounded-md border border-neutral-300 px-3 py-1.5 font-medium hover:border-sky-500 disabled:opacity-40 dark:border-neutral-700"
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="py-4 text-center text-sm text-neutral-500">Loading rows…</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
