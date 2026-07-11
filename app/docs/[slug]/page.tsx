import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Faq } from "@/components/seo/Faq";
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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-12">
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
    </main>
  );
}
