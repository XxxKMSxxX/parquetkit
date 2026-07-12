import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ConvertTool } from "@/components/tool/loaders";
import { Faq } from "@/components/seo/Faq";
import { Lead } from "@/components/seo/Lead";
import { Toc } from "@/components/seo/Toc";
import { Markdown } from "@/components/seo/Markdown";
import { findConversion, loadConversions } from "@/lib/content/loader";
import { extractToc } from "@/lib/content/toc";
import {
  SUPPORTED_CONVERSIONS,
  conversionSlug,
  parseConversionSlug,
} from "@/lib/engine/convert/jobs";

const FORMAT_LABELS: Record<string, string> = {
  parquet: "Parquet",
  csv: "CSV",
  json: "JSON",
  jsonl: "JSONL",
};

export function generateStaticParams(): { slug: string }[] {
  // Driven by content/conversions/. The schema refine rejects engine-unsupported slugs at build time
  return loadConversions().map((entry) => ({ slug: entry.meta.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = findConversion(slug);
  if (!entry) return {};
  return { title: entry.meta.title, description: entry.meta.description };
}

export default async function ConversionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = findConversion(slug);
  const pair = parseConversionSlug(slug);
  if (!entry || !pair) notFound();

  const from = FORMAT_LABELS[pair.from];
  const to = FORMAT_LABELS[pair.to];
  const toc = [
    ...extractToc(entry.body),
    ...(entry.meta.faq.length > 0
      ? [{ id: "frequently-asked-questions", text: "Frequently asked questions", level: 2 as const }]
      : []),
  ];

  return (
    <main id="main" className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Convert {from} to {to}
        </h1>
        <Lead text={entry.meta.description} />
      </header>

      <ConvertTool pair={pair} />

      <div className="-mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neutral-500 dark:text-neutral-400">Need a different conversion?</span>
        {SUPPORTED_CONVERSIONS.filter(
          (candidate) => conversionSlug(candidate) !== slug,
        ).map((candidate) => (
          <Link
            key={conversionSlug(candidate)}
            href={`/convert/${conversionSlug(candidate)}`}
            className="rounded-full border border-neutral-300 px-3 py-1 transition-colors hover:border-sky-500/60 hover:text-sky-600 dark:border-neutral-700 dark:hover:border-sky-400/60 dark:hover:text-sky-400"
          >
            {FORMAT_LABELS[candidate.from]} → {FORMAT_LABELS[candidate.to]}
          </Link>
        ))}
      </div>

      <details className="group rounded-lg border border-neutral-200 p-4 lg:hidden dark:border-neutral-800">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-400">
          On this page
        </summary>
        <div className="mt-3">
          <Toc items={toc} testId="toc-mobile" />
        </div>
      </details>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-16">
        <div className="flex min-w-0 flex-col gap-10">
          <div className="border-t border-neutral-200 pt-8 dark:border-neutral-800">
            <Markdown>{entry.body}</Markdown>
          </div>

          <Faq items={entry.meta.faq} />
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <Toc items={toc} />
          </div>
        </aside>
      </div>
    </main>
  );
}