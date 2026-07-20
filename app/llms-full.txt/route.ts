import { loadConversions, loadDocs } from "@/lib/content/loader";

export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** llms-full.txt companion to /llms.txt: full markdown bodies of every guide and converter page. */
export function GET(): Response {
  const sections = [
    ...loadConversions().map(
      ({ meta, body }) =>
        `# ${meta.title}\n\nURL: ${SITE}/convert/${meta.slug}\n\n${body}`,
    ),
    ...loadDocs().map(
      ({ meta, body }) =>
        `# ${meta.title}\n\nURL: ${SITE}/docs/${meta.slug}\n\n${body}`,
    ),
  ];

  const text = `${sections.join("\n\n---\n\n")}\n`;
  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
