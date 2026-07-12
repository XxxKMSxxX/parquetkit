import GithubSlugger from "github-slugger";
import type { TocItem } from "@/components/seo/Toc";

/**
 * Extract h2/h3 headings from a Markdown body at build time.
 * Slugs use github-slugger — the same algorithm rehype-slug applies to the
 * rendered headings, so the anchors always match.
 */
export function extractToc(body: string): TocItem[] {
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
  let inFence = false;
  for (const line of body.split("\n")) {
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.*)$/.exec(line);
    if (!match) continue;
    const text = match[2].replace(/`/g, "").trim();
    items.push({
      id: slugger.slug(text),
      text,
      level: match[1].length as 2 | 3,
    });
  }
  return items;
}
