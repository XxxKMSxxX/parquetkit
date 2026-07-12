import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ConvertTool } from "@/components/tool/loaders";
import { Faq } from "@/components/seo/Faq";
import { Markdown } from "@/components/seo/Markdown";
import { findConversion, loadConversions } from "@/lib/content/loader";
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

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Convert {from} to {to}
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          {entry.meta.description}
        </p>
      </header>

      <ConvertTool pair={pair} />

      <div className="border-t border-neutral-200 pt-8 dark:border-neutral-800">
        <Markdown>{entry.body}</Markdown>
      </div>

      <Faq items={entry.meta.faq} />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Other conversions</h2>
        <ul className="flex flex-wrap gap-2 text-sm">
          {SUPPORTED_CONVERSIONS.filter(
            (candidate) => conversionSlug(candidate) !== slug,
          ).map((candidate) => (
            <li key={conversionSlug(candidate)}>
              <Link
                href={`/convert/${conversionSlug(candidate)}`}
                className="rounded-full border border-neutral-300 px-3 py-1 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                {FORMAT_LABELS[candidate.from]} → {FORMAT_LABELS[candidate.to]}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
