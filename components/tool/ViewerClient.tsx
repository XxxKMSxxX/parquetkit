"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { stashFiles } from "./file-handoff";
import { FileDropZone } from "./FileDropZone";
import { DataTable } from "./DataTable";
import { formatBytes, formatRowCount } from "@/lib/engine/format/bytes";
import {
  asyncBufferFromBlob,
  openParquet,
  readRows,
  type ParquetHandle,
} from "@/lib/engine/parquet/reader";

const PAGE_SIZES = [50, 100, 500] as const;

interface LoadedFile {
  name: string;
  size: number;
  handle: ParquetHandle;
  file: File;
}

export function ViewerClient() {
  const router = useRouter();
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [schemaCopied, setSchemaCopied] = useState(false);
  const [pageSize, setPageSize] = useState<number>(50);

  const loadPage = useCallback(
    async (file: LoadedFile, nextPage: number, size: number) => {
      const total = Number(file.handle.info.numRows);
      const start = nextPage * size;
      const end = Math.min(start + size, total);
      setBusy(true);
      try {
        setRows(start < end ? await readRows(file.handle, start, end) : []);
        setPage(nextPage);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const onFiles = useCallback(
    async (files: File[]) => {
      const file = files[0];
      setError(null);
      setBusy(true);
      try {
        const handle = await openParquet(asyncBufferFromBlob(file));
        const next = { name: file.name, size: file.size, handle, file };
        setLoaded(next);
        await loadPage(next, 0, pageSize);
      } catch (e) {
        setLoaded(null);
        setError(
          e instanceof Error
            ? `Could not read this file with the instant viewer: ${e.message}`
            : String(e),
        );
      } finally {
        setBusy(false);
      }
    },
    [loadPage, pageSize],
  );

  useEffect(() => {
    if (!loaded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const total = Math.max(1, Math.ceil(Number(loaded.handle.info.numRows) / pageSize));
      if (e.key === "ArrowLeft" && page > 0) {
        void loadPage(loaded, page - 1, pageSize);
      } else if (e.key === "ArrowRight" && page < total - 1) {
        void loadPage(loaded, page + 1, pageSize);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loaded, page, pageSize, loadPage]);

  const loadSample = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/samples/demo.parquet");
      if (!res.ok) throw new Error(`sample fetch failed (${res.status})`);
      const blob = await res.blob();
      await onFiles([new File([blob], "demo.parquet", { type: "application/octet-stream" })]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }, [onFiles]);

  if (!loaded) {
    return (
      <div className="flex flex-col gap-3">
        <FileDropZone
          accept=".parquet"
          label="Drop a .parquet file here, or click to choose"
          sublabel="Any size — reading is streamed, not loaded into memory at once"
          onFiles={onFiles}
        />
        <p className="text-center text-sm text-neutral-500">
          No Parquet file handy?{" "}
          <button
            type="button"
            disabled={busy}
            onClick={loadSample}
            className="font-medium text-sky-600 underline underline-offset-2 transition-colors hover:text-sky-500 disabled:opacity-50 dark:text-sky-400 dark:hover:text-sky-300"
          >
            Load a sample file
          </button>{" "}
          — 5,000 e-commerce orders, 11 columns.
        </p>
        {error ? (
          <div className="flex flex-col gap-1">
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
            <p className="text-sm text-neutral-500">
              The instant viewer supports Snappy / Gzip / Zstd / LZ4-raw. For
              other encodings, try the{" "}
              <a href="/sql" className="underline">
                SQL Workbench
              </a>{" "}
              — its DuckDB engine reads a wider range of Parquet files.
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  const { info } = loaded.handle;
  const totalRows = Number(info.numRows);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  return (
    <div className="flex flex-col gap-6" data-testid="viewer-result">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-sm font-semibold">{loaded.name}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="open-in-sql"
            onClick={() => {
              stashFiles([loaded.file]);
              // Preserve the query string so ?duckdb=self carries over (CI)
              router.push(`/sql${window.location.search}`);
            }}
            className="rounded-md bg-sky-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-sky-500"
          >
            Query in SQL Workbench
          </button>
          <button
            type="button"
            onClick={() => {
              setLoaded(null);
              setRows([]);
              setError(null);
            }}
            className="rounded-md border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Open another file
          </button>
        </div>
      </div>

      <dl
        className="grid grid-cols-2 gap-3 rounded-lg border border-neutral-200 p-4 text-sm sm:grid-cols-3 lg:grid-cols-6 dark:border-neutral-800"
        data-testid="metadata-panel"
      >
        <div>
          <dt className="text-neutral-500">Rows</dt>
          <dd className="font-mono font-semibold">{formatRowCount(info.numRows)}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Columns</dt>
          <dd className="font-mono font-semibold">{info.numColumns}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Row groups</dt>
          <dd className="font-mono font-semibold">{info.numRowGroups}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Compression</dt>
          <dd className="font-mono font-semibold">{info.compressions.join(", ")}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">File size</dt>
          <dd className="font-mono font-semibold">{formatBytes(loaded.size)}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Created by</dt>
          <dd
            className="truncate font-mono font-semibold"
            title={info.createdBy ?? undefined}
          >
            {info.createdBy ?? "—"}
          </dd>
        </div>
      </dl>

      <section className="flex flex-col gap-2" data-testid="schema-panel">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Schema</h3>
          <button
            type="button"
            onClick={() => {
              const lines = [
                "| Column | Physical type | Logical type |",
                "|---|---|---|",
                ...info.columns.map(
                  (c) => `| ${c.name} | ${c.type} | ${c.logicalType ?? "—"} |`,
                ),
              ];
              void navigator.clipboard.writeText(lines.join("\n")).then(() => {
                setSchemaCopied(true);
                setTimeout(() => setSchemaCopied(false), 2000);
              });
            }}
            className="rounded-md border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            {schemaCopied ? "Copied!" : "Copy schema"}
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left dark:border-neutral-800 dark:bg-neutral-900">
                <th className="px-3 py-2 font-semibold">Column</th>
                <th className="px-3 py-2 font-semibold">Physical type</th>
                <th className="px-3 py-2 font-semibold">Logical type</th>
              </tr>
            </thead>
            <tbody>
              {info.columns.map((col) => (
                <tr
                  key={col.name}
                  className="border-b border-neutral-100 last:border-0 dark:border-neutral-900"
                >
                  <td className="px-3 py-1.5 font-mono text-xs">{col.name}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{col.type}</td>
                  <td className="px-3 py-1.5 font-mono text-xs text-neutral-500">
                    {col.logicalType ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Data</h3>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5 text-neutral-500">
              Rows
              <select
                value={pageSize}
                disabled={busy}
                data-testid="page-size"
                onChange={(e) => {
                  const size = Number(e.target.value);
                  // Keep the first visible row anchored when the size changes
                  const newPage = Math.floor((page * pageSize) / size);
                  setPageSize(size);
                  void loadPage(loaded, newPage, size);
                }}
                className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-base sm:text-sm dark:border-neutral-700 dark:bg-neutral-950"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 0 || busy}
                onClick={() => loadPage(loaded, page - 1, pageSize)}
                aria-label="Previous page"
                className="rounded-md border border-neutral-300 px-2 py-1 disabled:opacity-40 dark:border-neutral-700"
              >
                ←
              </button>
              <span className="flex items-center gap-1 tabular-nums">
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={page + 1}
                  disabled={busy}
                  data-testid="page-jump"
                  aria-label="Page number"
                  onChange={(e) => {
                    const target = Math.min(
                      totalPages,
                      Math.max(1, Number(e.target.value) || 1),
                    );
                    if (target - 1 !== page) void loadPage(loaded, target - 1, pageSize);
                  }}
                  // 16px on phones: below that iOS Safari force-zooms on focus
                  className="w-14 rounded-md border border-neutral-300 bg-transparent px-1 py-1 text-center text-base sm:text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
                / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1 || busy}
                onClick={() => loadPage(loaded, page + 1, pageSize)}
                aria-label="Next page"
                className="rounded-md border border-neutral-300 px-2 py-1 disabled:opacity-40 dark:border-neutral-700"
              >
                →
              </button>
            </div>
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
        <DataTable
          columns={info.columns.map((c) => c.name)}
          rows={rows}
          offset={page * pageSize}
        />
      </section>
    </div>
  );
}
