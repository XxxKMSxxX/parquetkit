import { loadDocs } from "@/lib/content/loader";

export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** RSS feed of the guides, regenerated on every build (weekly agent included). */
export function GET(): Response {
  const items = loadDocs()
    .map(
      ({ meta }) => `    <item>
      <title>${escapeXml(meta.title)}</title>
      <link>${SITE}/docs/${meta.slug}</link>
      <guid isPermaLink="true">${SITE}/docs/${meta.slug}</guid>
      <description>${escapeXml(meta.description)}</description>
    </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>ParquetKit Guides</title>
    <link>${SITE}/docs</link>
    <description>Practical guides on working with Parquet files — no Spark, no installs, everything in the browser.</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
