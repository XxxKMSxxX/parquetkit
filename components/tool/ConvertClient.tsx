"use client";

import { useCallback, useRef, useState } from "react";
import { FileDropZone } from "./FileDropZone";
import { resolveBundleSource } from "./bundle-source";
import { formatBytes } from "@/lib/engine/format/bytes";
import {
  buildConversionSql,
  outputFileMeta,
  type ConversionPair,
} from "@/lib/engine/convert/jobs";

interface ConvertClientProps {
  pair: ConversionPair;
}

interface Converted {
  url: string;
  fileName: string;
  inputSize: number;
  outputSize: number;
}

/** Download links must be clicked with a delay or browsers block the batch */
const BATCH_DOWNLOAD_INTERVAL_MS = 300;

const ACCEPT: Record<ConversionPair["from"], string> = {
  parquet: ".parquet",
  csv: ".csv",
  json: ".json",
  jsonl: ".jsonl,.ndjson",
};

// Sample inputs served from /public — lets visitors try the converter without a file
const SAMPLES: Partial<Record<ConversionPair["from"], string>> = {
  parquet: "/samples/demo.parquet",
  csv: "/samples/demo.csv",
  jsonl: "/samples/demo.jsonl",
};

// The heavy conversion work runs inside DuckDB's own Web Worker,
// so this call never blocks the main thread
async function loadEngine() {
  return import("@/lib/engine/duckdb");
}

export function ConvertClient({ pair }: ConvertClientProps) {
  const [status, setStatus] = useState<
    "idle" | "loading-engine" | "converting"
  >("idle");
  const [results, setResults] = useState<Converted[]>([]);
  const [error, setError] = useState<string | null>(null);
  const prefetched = useRef(false);

  const prefetch = useCallback(() => {
    if (prefetched.current) return;
    prefetched.current = true;
    void loadEngine().then((engine) => engine.initDuckDB(resolveBundleSource()));
  }, []);

  const onFiles = useCallback(
    async (files: File[]) => {
      setError(null);
      // Revoke the previous batch before starting a new one
      setResults((prev) => {
        prev.forEach((converted) => URL.revokeObjectURL(converted.url));
        return [];
      });
      setStatus("loading-engine");
      try {
        const engine = await loadEngine();
        const db = await engine.initDuckDB(resolveBundleSource());
        setStatus("converting");

        const { extension, mimeType } = outputFileMeta(pair.to);
        const batch: Converted[] = [];
        for (const [index, file] of files.entries()) {
          const inputName = `input-${index}.${pair.from}`;
          const outputName = `output-${index}.${extension}`;
          await engine.registerFile(db, inputName, file);
          const sql = buildConversionSql(pair, inputName, outputName);
          const bytes = await engine.runCopy(db, sql, outputName);
          await engine.dropFile(db, inputName).catch(() => undefined);

          const blob = new Blob(
            [bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer],
            { type: mimeType },
          );
          const baseName = file.name.replace(/\.[^.]+$/, "") || "converted";
          batch.push({
            url: URL.createObjectURL(blob),
            fileName: `${baseName}.${extension}`,
            inputSize: file.size,
            outputSize: blob.size,
          });
          setResults([...batch]);
        }

        // Auto-download only for a single file — browsers block download bursts
        if (batch.length === 1) {
          const anchor = document.createElement("a");
          anchor.href = batch[0].url;
          anchor.download = batch[0].fileName;
          anchor.click();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setStatus("idle");
      }
    },
    [pair],
  );

  const downloadAll = useCallback(() => {
    results.forEach((converted, index) => {
      setTimeout(() => {
        const anchor = document.createElement("a");
        anchor.href = converted.url;
        anchor.download = converted.fileName;
        anchor.click();
      }, index * BATCH_DOWNLOAD_INTERVAL_MS);
    });
  }, [results]);

  return (
    <div className="flex flex-col gap-4">
      <FileDropZone
        accept={ACCEPT[pair.from]}
        multiple
        label={
          status === "idle"
            ? `Drop ${pair.from.toUpperCase()} files to convert to ${pair.to.toUpperCase()}`
            : status === "loading-engine"
              ? "Loading conversion engine…"
              : "Converting…"
        }
        sublabel="A single file downloads automatically; batches get a download list"
        onFiles={onFiles}
        onInteract={prefetch}
      />

      {SAMPLES[pair.from] ? (
        <p className="-mt-1 text-center text-sm text-neutral-500">
          No {pair.from.toUpperCase()} file handy?{" "}
          <button
            type="button"
            disabled={status !== "idle"}
            data-testid="convert-sample"
            onClick={async () => {
              setError(null);
              const url = SAMPLES[pair.from];
              if (!url) return;
              try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`sample fetch failed (${res.status})`);
                const blob = await res.blob();
                await onFiles([
                  new File([blob], `demo.${pair.from}`, {
                    type: "application/octet-stream",
                  }),
                ]);
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
            className="font-medium text-sky-600 underline underline-offset-2 transition-colors hover:text-sky-500 disabled:opacity-50 dark:text-sky-400 dark:hover:text-sky-300"
          >
            Convert a sample file
          </button>
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="font-mono text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {results.length > 0 ? (
        <div
          className="flex flex-col gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm dark:border-green-900 dark:bg-green-950/30"
          data-testid="convert-result"
        >
          {results.length > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">
                {results.length} files converted
              </p>
              <button
                type="button"
                onClick={downloadAll}
                className="rounded-md bg-green-700 px-4 py-1.5 font-semibold text-white hover:bg-green-600"
              >
                Download all
              </button>
            </div>
          ) : null}
          <ul className="flex flex-col gap-1.5">
            {results.map((converted) => (
              <li
                key={converted.url}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <p>
                  <span className="font-semibold">{converted.fileName}</span>{" "}
                  <span className="text-neutral-500">
                    ({formatBytes(converted.inputSize)} →{" "}
                    {formatBytes(converted.outputSize)})
                  </span>
                </p>
                <a
                  href={converted.url}
                  download={converted.fileName}
                  className="rounded-md bg-green-700 px-4 py-1.5 font-semibold text-white hover:bg-green-600"
                >
                  {results.length > 1 ? "Download" : "Download again"}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
