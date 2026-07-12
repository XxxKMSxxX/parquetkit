import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Page not found</h1>
      <p className="max-w-md text-neutral-600 dark:text-neutral-400">
        This page does not exist — but your Parquet file is probably still
        waiting to be opened.
      </p>
      <div className="flex flex-wrap justify-center gap-3 text-sm">
        <Link
          href="/parquet-viewer"
          className="rounded-md bg-sky-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-sky-500"
        >
          Open the Parquet Viewer
        </Link>
        <Link
          href="/"
          className="rounded-md border border-neutral-300 px-4 py-2 transition-colors hover:border-sky-500/60 dark:border-neutral-700 dark:hover:border-sky-400/60"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
