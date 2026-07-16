import type { Metadata } from "next";
import { DiffTool } from "@/components/tool/loaders";
import { JsonLd, softwareAppJsonLd } from "@/components/seo/JsonLd";

const TITLE = "Compare Two Parquet Files Online — Parquet Diff";
const DESCRIPTION =
  "Free online Parquet diff. Compare two Parquet files by key and see added, removed and changed rows plus schema changes — locally in your browser, nothing uploaded.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
};

export default function ParquetDiffPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Parquet Diff</h1>
        <div className="flex flex-col text-neutral-600 dark:text-neutral-400">
          <p>
            Two versions of a dataset, one question: what actually changed?
            Join both files on a key column and see the added, removed and
            changed rows — plus any schema drift — before you ship the new
            version.
          </p>
          <p>
            Nothing is uploaded: the comparison runs locally via WebAssembly,
            so it is safe for confidential data.
          </p>
        </div>
      </header>

      <DiffTool />

      <section className="grid gap-8 border-t border-neutral-200 pt-8 lg:grid-cols-2 dark:border-neutral-800">
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">How it works</h2>
          <p className="text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
            Byte-level diff tools report every Parquet file pair as different —
            row-group layout, compression and encoding all change the bytes
            without changing the data. This tool compares the data itself: both
            files are joined on the key you pick (inside an in-browser DuckDB
            database), rows are classified as added, removed, changed or
            unchanged, and changed rows show exactly which cells differ. Schema
            changes — added, removed or re-typed columns — are detected
            instantly from the file metadata, before any rows are read.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">When you need this</h2>
          <p className="text-[15px] leading-7 text-neutral-600 dark:text-neutral-400">
            Re-ran a pipeline and want to check the output still matches
            yesterday&apos;s? Reviewing a data hand-off and need to confirm
            what a colleague changed? Migrating jobs and validating that the
            new code writes the same rows? The usual answer is a throwaway
            pandas script — load both files, merge on a key, compare columns.
            This page replaces that script with a drag &amp; drop, and because
            everything runs client-side, it works with files you are not
            allowed to upload anywhere.
          </p>
        </div>
      </section>

      <JsonLd
        data={softwareAppJsonLd(
          process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
          {
            name: "ParquetKit — Parquet Diff",
            description: DESCRIPTION,
            url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/diff`,
          },
        )}
      />
    </main>
  );
}
