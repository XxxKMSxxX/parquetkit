import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import {
  conversionContentSchema,
  docContentSchema,
} from "@/lib/content/schema";
import { SUPPORTED_CONVERSIONS, conversionSlug } from "@/lib/engine/convert/jobs";

// コンテンツ品質の安全網。このテストが落ちるコンテンツは本番に出ない。

const CONTENT = path.resolve(__dirname, "../../content");

function listMd(dir: string): { name: string; raw: string }[] {
  return readdirSync(path.join(CONTENT, dir))
    .filter((name) => name.endsWith(".md"))
    .map((name) => ({
      name: `${dir}/${name}`,
      raw: readFileSync(path.join(CONTENT, dir, name), "utf8"),
    }));
}

describe("conversionコンテンツ", () => {
  const files = listMd("conversions");

  it("全ファイルのfrontmatterがスキーマに適合し、slugとファイル名が一致する", () => {
    for (const file of files) {
      const { data } = matter(file.raw);
      const meta = conversionContentSchema.parse(data);
      expect(`conversions/${meta.slug}.md`).toBe(file.name);
    }
  });

  it("サポートする全変換ペアにコンテンツが存在する", () => {
    const slugs = files.map((file) => matter(file.raw).data.slug);
    for (const pair of SUPPORTED_CONVERSIONS) {
      expect(slugs).toContain(conversionSlug(pair));
    }
  });
});

describe("docsコンテンツ", () => {
  it("全ファイルのfrontmatterがスキーマに適合し、slugとファイル名が一致する", () => {
    for (const file of listMd("docs")) {
      const { data } = matter(file.raw);
      const meta = docContentSchema.parse(data);
      expect(`docs/${meta.slug}.md`).toBe(file.name);
    }
  });
});

describe("コンテンツの安全性", () => {
  it("生HTMLタグ・スクリプトを含まない(react-markdownは描画しないが混入自体を禁止)", () => {
    for (const dir of ["conversions", "docs"]) {
      for (const file of listMd(dir)) {
        expect(file.raw, file.name).not.toMatch(/<\s*(script|iframe|object|embed|form)/i);
        expect(file.raw, file.name).not.toMatch(/javascript:/i);
        // HTMLタグ内のイベントハンドラ属性(onclick=等)のみ検出(SQLのON句は許可)
        expect(file.raw, file.name).not.toMatch(/<[^>]*\son\w+\s*=/i);
      }
    }
  });

  it("外部リンクはhttpsのみ、内部リンクは絶対パス", () => {
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
