import Link from "next/link";

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

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16">
      <section className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Work with Parquet files, entirely in your browser
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          View, query and convert Parquet files without installing Spark,
          pandas or anything else. All processing happens locally via
          WebAssembly — <strong>your files never leave your device</strong>.
        </p>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="rounded-lg border border-neutral-200 p-4 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
          >
            <h2 className="font-semibold">{tool.title}</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {tool.description}
            </p>
          </Link>
        ))}
      </section>
      <section className="flex flex-col gap-2 text-sm">
        <h2 className="font-semibold">Guides</h2>
        <p className="text-neutral-600 dark:text-neutral-400">
          Practical articles on working with Parquet —{" "}
          <Link href="/docs" className="underline">
            browse all guides
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
