import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  conversionContentSchema,
  docContentSchema,
  type ConversionContent,
  type DocContent,
} from "./schema";

const CONTENT_ROOT = path.join(process.cwd(), "content");

// コンテンツはビルド時にのみ読まれる(静的エクスポート)。
// frontmatterのzod検証がここで走るため、壊れたコンテンツはビルドを落とす
// = content-automerge の安全網。

function loadDir<T>(
  dir: string,
  parse: (frontmatter: unknown, file: string) => T,
): { meta: T; body: string }[] {
  const full = path.join(CONTENT_ROOT, dir);
  return readdirSync(full)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => {
      const raw = readFileSync(path.join(full, name), "utf8");
      const { data, content } = matter(raw);
      return { meta: parse(data, `${dir}/${name}`), body: content.trim() };
    });
}

export function loadConversions(): { meta: ConversionContent; body: string }[] {
  return loadDir("conversions", (data, file) => {
    const result = conversionContentSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`${file}: frontmatterが不正です\n${result.error.message}`);
    }
    return result.data;
  });
}

export function loadDocs(): { meta: DocContent; body: string }[] {
  return loadDir("docs", (data, file) => {
    const result = docContentSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`${file}: frontmatterが不正です\n${result.error.message}`);
    }
    return result.data;
  });
}

export function findConversion(slug: string) {
  return loadConversions().find((entry) => entry.meta.slug === slug) ?? null;
}

export function findDoc(slug: string) {
  return loadDocs().find((entry) => entry.meta.slug === slug) ?? null;
}
