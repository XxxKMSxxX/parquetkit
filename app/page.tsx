import Image from "next/image";
import { preload } from "react-dom";
import Link from "next/link";
import { loadConversions, loadDocs } from "@/lib/content/loader";
import { JsonLd, softwareAppJsonLd } from "@/components/seo/JsonLd";

const tools = [
  {
    href: "/parquet-viewer",
    title: "Parquet Viewer",
    description:
      "Drop a .parquet file to inspect its schema, metadata and rows instantly.",
  },
  {
    href: "/sql",
    title: "SQL Workbench",
    description:
      "Run SQL queries against local Parquet, CSV and JSON files with DuckDB.",
  },
  {
    href: "/convert/parquet-to-csv",
    title: "Converters",
    description:
      "Convert between Parquet, CSV, JSON and JSONL without uploading anything.",
  },
] as const;

const proofs = [
  {
    value: "344 ms",
    label: "to open a 1.3 GB Parquet file — only the metadata footer is read",
  },
  {
    value: "0 uploads",
    label: "static site with no backend; there is nowhere to send your file",
  },
  {
    value: "MIT",
    label: "open source — verify the privacy claim in the code yourself",
  },
] as const;

const FORMAT_LABELS: Record<string, string> = {
  parquet: "Parquet",
  csv: "CSV",
  json: "JSON",
  jsonl: "JSONL",
};

function conversionLabel(slug: string): string {
  const [from, to] = slug.split("-to-");
  return `${FORMAT_LABELS[from] ?? from} → ${FORMAT_LABELS[to] ?? to}`;
}

export default function Home() {
  // The hero poster is the LCP element — tell the browser about it immediately
  preload("/hero-demo-poster.webp", { as: "image", fetchPriority: "high" });
  const conversions = loadConversions();
  const docs = loadDocs();

  return (
    <main id="main" className="relative mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-12 px-6 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-16 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.10),transparent_60%)]"
      />
      <section className="grid items-center gap-8 lg:grid-cols-[1fr_minmax(0,640px)]">
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-bold tracking-tight">
            Work with Parquet files, entirely in your browser
          </h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-400">
            View, query and convert Parquet files without installing Spark,
            pandas or anything else. All processing happens locally via
            WebAssembly — <strong>your files never leave your device</strong>.
          </p>
        </div>
        <Link
          href="/parquet-viewer"
          className="group flex flex-col gap-2"
        >
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/hero-demo-poster.webp"
            aria-hidden="true"
            className="w-full rounded-lg border border-neutral-200 transition-colors group-hover:border-sky-500/60 motion-reduce:hidden dark:border-neutral-800 dark:group-hover:border-sky-400/60"
          >
            <source src="/hero-demo.mp4" type="video/mp4" />
          </video>
          <Image
            src="/hero-demo-poster.webp"
            width={1280}
            height={720}
            alt="The Parquet Viewer showing schema and rows of a sample dataset"
            className="hidden w-full rounded-lg border border-neutral-200 motion-reduce:block dark:border-neutral-800"
          />
          <span className="text-center text-xs text-neutral-400 transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-400">
            The sample dataset opening in the viewer — try it yourself →
          </span>
        </Link>
      </section>

      <section aria-label="Why ParquetKit" className="grid gap-4 sm:grid-cols-3">
        {proofs.map((proof) => (
          <div
            key={proof.value}
            className="border-l-2 border-sky-500/60 pl-4"
          >
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {proof.value}
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {proof.label}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group rounded-lg border border-neutral-200 p-4 transition-colors hover:border-sky-500/60 dark:border-neutral-800 dark:hover:border-sky-400/60"
          >
            <h2 className="font-semibold transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-400">
              {tool.title}
              <span aria-hidden="true" className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {tool.description}
            </p>
          </Link>
        ))}
      </section>

      <JsonLd
        data={softwareAppJsonLd(
          process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
        )}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Converters
        </h2>
        <ul className="flex flex-wrap gap-2">
          {conversions.map(({ meta }) => (
            <li key={meta.slug}>
              <Link
                href={`/convert/${meta.slug}`}
                className="inline-block rounded-full border border-neutral-200 px-3 py-1 font-mono text-sm transition-colors hover:border-sky-500/60 hover:text-sky-600 dark:border-neutral-800 dark:hover:border-sky-400/60 dark:hover:text-sky-400"
              >
                {conversionLabel(meta.slug)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Guides
        </h2>
        <ul className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-900">
          {docs.slice(0, 6).map(({ meta }) => (
            <li key={meta.slug}>
              <Link
                href={`/docs/${meta.slug}`}
                className="group flex flex-col gap-0.5 py-3"
              >
                <span className="font-medium transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-400">
                  {meta.title}
                </span>
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {meta.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          <Link
            href="/docs"
            className="underline transition-colors hover:text-sky-600 dark:hover:text-sky-400"
          >
            Browse all guides
          </Link>
        </p>
      </section>
    </main>
  );
}
