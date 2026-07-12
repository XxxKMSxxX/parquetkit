import type { Metadata } from "next";
import Link from "next/link";
import { loadDocs } from "@/lib/content/loader";

export const metadata: Metadata = {
  title: "Guides — Working with Parquet Files",
  description:
    "Practical guides on opening, querying and converting Parquet files — no Spark, no installs, everything in the browser.",
};

export default function DocsIndexPage() {
  const docs = loadDocs();
  return (
    <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Guides</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Practical, tool-agnostic guides on working with Parquet files.
        </p>
      </header>
      <ul className="flex flex-col gap-4">
        {docs.map((doc) => (
          <li key={doc.meta.slug}>
            <Link
              href={`/docs/${doc.meta.slug}`}
              className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-4 transition-colors hover:border-sky-500/60 dark:border-neutral-800 dark:hover:border-sky-400/60"
            >
              <h2 className="font-semibold">{doc.meta.title}</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {doc.meta.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
