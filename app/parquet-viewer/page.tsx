import type { Metadata } from "next";
import { ViewerTool } from "@/components/tool/loaders";
import { JsonLd, softwareAppJsonLd } from "@/components/seo/JsonLd";

const TITLE = "Online Parquet Viewer — Open Parquet Files in Your Browser";
const DESCRIPTION =
  "Free online Parquet file viewer. Inspect schema, metadata and rows locally in your browser. No upload, no signup — your data never leaves your device.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
};

export default function ParquetViewerPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Parquet Viewer</h1>
        <div className="flex flex-col text-neutral-600 dark:text-neutral-400">
          <p>
            Open a Parquet file and inspect its schema, metadata and data —
            right here in your browser.
          </p>
          <p>
            Nothing is uploaded: reading happens locally via WebAssembly, so it
            works with confidential data and multi-gigabyte files alike.
          </p>
        </div>
      </header>

      <ViewerTool />

      <section className="grid gap-8 border-t border-neutral-200 pt-8 lg:grid-cols-2 dark:border-neutral-800">
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">How it works</h2>
          <p className="text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
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
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Why view Parquet in the browser?</h2>
          <p className="text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
          Parquet is a columnar binary format — you cannot just open it in a
          text editor, and spinning up Spark, pandas or DuckDB on your laptop
          just to peek at a file is overkill. This page replaces that ritual
          with a drag &amp; drop. Because processing is fully client-side, it
          is also safe for files you are not allowed to upload to third-party
          services or AI chatbots.
          </p>
        </div>
      </section>

      <JsonLd
        data={softwareAppJsonLd(
          process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
          {
            name: "ParquetKit — Parquet Viewer",
            description: DESCRIPTION,
            url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/parquet-viewer`,
          },
        )}
      />
    </main>
  );
}
