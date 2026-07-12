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
  const [result, setResult] = useState<Converted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prefetched = useRef(false);

  const prefetch = useCallback(() => {
    if (prefetched.current) return;
    prefetched.current = true;
    void loadEngine().then((engine) => engine.initDuckDB(resolveBundleSource()));
  }, []);

  const onFiles = useCallback(
    async (files: File[]) => {
      const file = files[0];
      setError(null);
      setResult(null);
      setStatus("loading-engine");
      try {
        const engine = await loadEngine();
        const db = await engine.initDuckDB(resolveBundleSource());

        setStatus("converting");
        const inputName = `input.${pair.from}`;
        await engine.registerFile(db, inputName, file);

        const { extension, mimeType } = outputFileMeta(pair.to);
        const outputName = `output.${extension}`;
        const sql = buildConversionSql(pair, inputName, outputName);
        const bytes = await engine.runCopy(db, sql, outputName);
        await engine.dropFile(db, inputName).catch(() => undefined);

        const blob = new Blob(
          [bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer],
          { type: mimeType },
        );
        const url = URL.createObjectURL(blob);
        const baseName = file.name.replace(/\.[^.]+$/, "") || "converted";
        const fileName = `${baseName}.${extension}`;

        setResult((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { url, fileName, inputSize: file.size, outputSize: blob.size };
        });

        // Trigger the automatic download
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setStatus("idle");
      }
    },
    [pair],
  );

  return (
    <div className="flex flex-col gap-4">
      <FileDropZone
        accept={ACCEPT[pair.from]}
        label={
          status === "idle"
            ? `Drop a ${pair.from.toUpperCase()} file to convert to ${pair.to.toUpperCase()}`
            : status === "loading-engine"
              ? "Loading conversion engine…"
              : "Converting…"
        }
        sublabel="The converted file downloads automatically when done"
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

      {result ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm dark:border-green-900 dark:bg-green-950/30"
          data-testid="convert-result"
        >
          <p>
            <span className="font-semibold">{result.fileName}</span>{" "}
            <span className="text-neutral-500">
              ({formatBytes(result.inputSize)} → {formatBytes(result.outputSize)})
            </span>
          </p>
          <a
            href={result.url}
            download={result.fileName}
            className="rounded-md bg-green-700 px-4 py-1.5 font-semibold text-white hover:bg-green-600"
          >
            Download again
          </a>
        </div>
      ) : null}
    </div>
  );
}
