import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Faq } from "@/components/seo/Faq";
import { ShareButtons } from "@/components/seo/ShareButtons";
import { Markdown } from "@/components/seo/Markdown";
import { findDoc, loadDocs } from "@/lib/content/loader";

export function generateStaticParams(): { slug: string }[] {
  return loadDocs().map((entry) => ({ slug: entry.meta.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = findDoc(slug);
  if (!entry) return {};
  return { title: entry.meta.title, description: entry.meta.description };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = findDoc(slug);
  if (!entry) notFound();

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const related = loadDocs()
    .filter((doc) => doc.meta.slug !== slug)
    .slice(0, 3);

  return (
    <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex max-w-2xl flex-col gap-3">
        <p className="text-sm">
          <Link href="/docs" className="text-neutral-500 underline">
            Guides
          </Link>
        </p>
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight">{entry.meta.title}</h1>
      </header>

      <Markdown>{entry.body}</Markdown>

      <Faq items={entry.meta.faq} />

      <ShareButtons url={`${site}/docs/${slug}`} title={entry.meta.title} />

      {related.length > 0 ? (
        <section className="flex max-w-3xl flex-col gap-3 border-t border-neutral-200 pt-8 dark:border-neutral-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            More guides
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {related.map((doc) => (
              <li key={doc.meta.slug}>
                <Link
                  href={`/docs/${doc.meta.slug}`}
                  className="underline transition-colors hover:text-sky-600 dark:hover:text-sky-400"
                >
                  {doc.meta.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
