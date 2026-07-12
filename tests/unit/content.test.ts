import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import {
  conversionContentSchema,
  docContentSchema,
} from "@/lib/content/schema";
import { SUPPORTED_CONVERSIONS, conversionSlug } from "@/lib/engine/convert/jobs";

// Safety net for content quality. Content that fails these tests never reaches production.

const CONTENT = path.resolve(__dirname, "../../content");

function listMd(dir: string): { name: string; raw: string }[] {
  return readdirSync(path.join(CONTENT, dir))
    .filter((name) => name.endsWith(".md"))
    .map((name) => ({
      name: `${dir}/${name}`,
      raw: readFileSync(path.join(CONTENT, dir, name), "utf8"),
    }));
}

describe("conversion content", () => {
  const files = listMd("conversions");

  it("all frontmatter matches the schema and slugs equal file names", () => {
    for (const file of files) {
      const { data } = matter(file.raw);
      const meta = conversionContentSchema.parse(data);
      expect(`conversions/${meta.slug}.md`).toBe(file.name);
    }
  });

  it("every supported conversion pair has content", () => {
    const slugs = files.map((file) => matter(file.raw).data.slug);
    for (const pair of SUPPORTED_CONVERSIONS) {
      expect(slugs).toContain(conversionSlug(pair));
    }
  });
});

describe("docs content", () => {
  it("all frontmatter matches the schema and slugs equal file names", () => {
    for (const file of listMd("docs")) {
      const { data } = matter(file.raw);
      const meta = docContentSchema.parse(data);
      expect(`docs/${meta.slug}.md`).toBe(file.name);
    }
  });
});

describe("content safety", () => {
  it("contains no raw HTML tags or scripts (react-markdown would not render them, but ban the injection itself)", () => {
    for (const dir of ["conversions", "docs"]) {
      for (const file of listMd(dir)) {
        expect(file.raw, file.name).not.toMatch(/<\s*(script|iframe|object|embed|form)/i);
        expect(file.raw, file.name).not.toMatch(/javascript:/i);
        // Only detect event-handler attributes inside HTML tags (onclick= etc.); SQL ON clauses are allowed
        expect(file.raw, file.name).not.toMatch(/<[^>]*\son\w+\s*=/i);
      }
    }
  });

  it("external links are https-only and internal links are absolute paths", () => {
    for (const dir of ["conversions", "docs"]) {
      for (const file of listMd(dir)) {
        const links = [...file.raw.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
        for (const link of links) {
          expect(
            link.startsWith("/") || link.startsWith("https://") || link.startsWith("#"),
            `${file.name}: ${link}`,
          ).toBe(true);
        }
      }
    }
  });
});
