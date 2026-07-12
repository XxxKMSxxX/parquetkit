import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Faq } from "@/components/seo/Faq";
import { ShareButtons } from "@/components/seo/ShareButtons";
import { Markdown } from "@/components/seo/Markdown";
import { findDoc, loadDocs } from "@/lib/content/loader";
import { extractToc } from "@/lib/content/toc";
import { Toc } from "@/components/seo/Toc";
import { JsonLd, techArticleJsonLd } from "@/components/seo/JsonLd";

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
  const toc = [
    ...extractToc(entry.body),
    ...(entry.meta.faq.length > 0
      ? [{ id: "frequently-asked-questions", text: "Frequently asked questions", level: 2 as const }]
      : []),
  ];

  return (
    <main id="main" className="mx-auto w-full max-w-[1800px] flex-1 px-6 py-12 lg:grid lg:grid-cols-[minmax(0,52rem)_16rem] lg:justify-between lg:gap-12">
      <div className="flex min-w-0 flex-col gap-10">
      <details className="group rounded-lg border border-neutral-200 p-4 lg:hidden dark:border-neutral-800">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-400">
          On this page
        </summary>
        <div className="mt-3">
          <Toc items={toc} testId="toc-mobile" />
        </div>
      </details>
      <header className="flex flex-col gap-3">
        <p className="text-sm">
          <Link href="/docs" className="text-neutral-500 underline">
            Guides
          </Link>
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{entry.meta.title}</h1>
      </header>

      <Markdown>{entry.body}</Markdown>

      <Faq items={entry.meta.faq} />
      <JsonLd
        data={techArticleJsonLd({
          site,
          slug,
          title: entry.meta.title,
          description: entry.meta.description,
        })}
      />

      <ShareButtons url={`${site}/docs/${slug}`} title={entry.meta.title} />

      {related.length > 0 ? (
        <section className="flex flex-col gap-3 border-t border-neutral-200 pt-8 dark:border-neutral-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
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
      </div>
      <aside className="hidden lg:block">
        <div className="sticky top-20">
          <Toc items={toc} />
        </div>
      </aside>
    </main>
  );
}
