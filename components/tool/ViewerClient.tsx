"use client";

import { useCallback, useState } from "react";
import { FileDropZone } from "./FileDropZone";
import { DataTable } from "./DataTable";
import { formatBytes, formatRowCount } from "@/lib/engine/format/bytes";
import {
  asyncBufferFromBlob,
  openParquet,
  readRows,
  type ParquetHandle,
} from "@/lib/engine/parquet/reader";

const PAGE_SIZE = 50;

interface LoadedFile {
  name: string;
  size: number;
  handle: ParquetHandle;
}

export function ViewerClient() {
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadPage = useCallback(async (file: LoadedFile, nextPage: number) => {
    const total = Number(file.handle.info.numRows);
    const start = nextPage * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, total);
    setBusy(true);
    try {
      setRows(start < end ? await readRows(file.handle, start, end) : []);
      setPage(nextPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const onFiles = useCallback(
    async (files: File[]) => {
      const file = files[0];
      setError(null);
      setBusy(true);
      try {
        const handle = await openParquet(asyncBufferFromBlob(file));
        const next = { name: file.name, size: file.size, handle };
        setLoaded(next);
        await loadPage(next, 0);
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
    [loadPage],
  );

  if (!loaded) {
    return (
      <div className="flex flex-col gap-3">
        <FileDropZone
          accept=".parquet"
          label="Drop a .parquet file here, or click to choose"
          sublabel="Any size — reading is streamed, not loaded into memory at once"
          onFiles={onFiles}
        />
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
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6" data-testid="viewer-result">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-sm font-semibold">{loaded.name}</h2>
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

      <dl
        className="grid grid-cols-2 gap-3 rounded-lg border border-neutral-200 p-4 text-sm sm:grid-cols-5 dark:border-neutral-800"
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
      </dl>

      <section className="flex flex-col gap-2" data-testid="schema-panel">
        <h3 className="font-semibold">Schema</h3>
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
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Data</h3>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              disabled={page === 0 || busy}
              onClick={() => loadPage(loaded, page - 1)}
              className="rounded-md border border-neutral-300 px-2 py-1 disabled:opacity-40 dark:border-neutral-700"
            >
              ←
            </button>
            <span className="tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages - 1 || busy}
              onClick={() => loadPage(loaded, page + 1)}
              className="rounded-md border border-neutral-300 px-2 py-1 disabled:opacity-40 dark:border-neutral-700"
            >
              →
            </button>
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
          offset={page * PAGE_SIZE}
        />
      </section>
    </div>
  );
}
