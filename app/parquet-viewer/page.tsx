import type { Metadata } from "next";
import { ViewerTool } from "@/components/tool/loaders";

export const metadata: Metadata = {
  title: "Online Parquet Viewer — Open Parquet Files in Your Browser",
  description:
    "Free online Parquet file viewer. Inspect schema, metadata and rows locally in your browser. No upload, no signup — your data never leaves your device.",
};

export default function ParquetViewerPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Parquet Viewer</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Open a Parquet file and inspect its schema, metadata and data — right
          here in your browser. Nothing is uploaded: reading happens locally
          via WebAssembly, so it works with confidential data and
          multi-gigabyte files alike.
        </p>
      </header>

      <ViewerTool />

      <section className="flex flex-col gap-3 border-t border-neutral-200 pt-8 dark:border-neutral-800">
        <h2 className="text-xl font-semibold">How it works</h2>
        <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          This viewer reads Parquet files with{" "}
          <a
            className="underline"
            href="https://github.com/hyparam/hyparquet"
            rel="noopener"
          >
            hyparquet
          </a>
          , a pure-JavaScript Parquet reader. Only the metadata footer and the
          row ranges you actually look at are read from disk, so opening a
          large file is instant — the file is never loaded into memory in full,
          and never sent to any server. Snappy, Gzip, Zstd and LZ4 compressed
          files are all supported.
        </p>
        <h2 className="text-xl font-semibold">Why view Parquet in the browser?</h2>
        <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Parquet is a columnar binary format — you cannot just open it in a
          text editor, and spinning up Spark, pandas or DuckDB on your laptop
          just to peek at a file is overkill. This page replaces that ritual
          with a drag &amp; drop. Because processing is fully client-side, it
          is also safe for files you are not allowed to upload to third-party
          services or AI chatbots.
        </p>
      </section>
    </main>
  );
}
