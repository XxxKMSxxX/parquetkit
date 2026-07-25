import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import { buildRelatedGraph, pickRelated, type RelatedInput } from "@/lib/content/related";

// 内部リンクの行き先はSEO上の資産なので、関連度の壊れ(全記事が同じ行き先になる、
// 一部の記事が被リンクゼロで孤立する)をここで検出する。

const DOCS: RelatedInput[] = [
  {
    slug: "merge-multiple-parquet-files",
    title: "How to Merge Multiple Parquet Files into One",
    description: "Combine several Parquet files into a single dataset with DuckDB SQL.",
  },
  {
    slug: "compare-two-parquet-files",
    title: "How to Compare Two Parquet Files and See What Changed",
    description: "Diff two Parquet files by key to find added, removed and changed rows.",
  },
  {
    slug: "parquet-magic-bytes-not-found",
    title: 'Parquet "Magic Bytes Not Found" — What It Means and How to Fix It',
    description: "The PAR1 magic bytes error means your Parquet file is truncated or not Parquet.",
  },
  {
    slug: "check-if-parquet-file-is-corrupted",
    title: "How to Check If a Parquet File Is Corrupted",
    description: "Validate a truncated or corrupted Parquet file and scan every row group.",
  },
  {
    slug: "open-parquet-in-excel",
    title: "How to Open a Parquet File in Excel (Step by Step)",
    description: "Excel cannot read Parquet natively. Convert the file to CSV in your browser.",
  },
];

describe("pickRelated", () => {
  it("ranks topically closer articles first", () => {
    const related = pickRelated(DOCS, "parquet-magic-bytes-not-found");
    // 「壊れたファイル」を扱う記事が、Excel変換より先に来る
    expect(related[0].slug).toBe("check-if-parquet-file-is-corrupted");
  });

  it("never includes the article itself", () => {
    for (const doc of DOCS) {
      const related = pickRelated(DOCS, doc.slug);
      expect(related.map((entry) => entry.slug)).not.toContain(doc.slug);
    }
  });

  it("respects the limit and returns fewer only when the corpus is smaller", () => {
    expect(pickRelated(DOCS, "open-parquet-in-excel")).toHaveLength(3);
    expect(pickRelated(DOCS, "open-parquet-in-excel", 10)).toHaveLength(DOCS.length - 1);
    expect(pickRelated(DOCS.slice(0, 2), "merge-multiple-parquet-files")).toHaveLength(1);
  });

  it("leaves no article without an inbound link, on the real corpus", () => {
    // 合成データでは孤立が再現しない。孤立は実際のトピック分布で起きる
    // (エラーメッセージ系の記事が他とほとんど語を共有しないため)ので、
    // 本番コンテンツそのものを対象に検証する。記事が増えても効き続ける。
    const dir = path.resolve(__dirname, "../../content/docs");
    const docs: RelatedInput[] = readdirSync(dir)
      .filter((name) => name.endsWith(".md"))
      .map((name) => {
        const { data } = matter(readFileSync(path.join(dir, name), "utf8"));
        return {
          slug: data.slug as string,
          title: data.title as string,
          description: data.description as string,
        };
      });

    const graph = buildRelatedGraph(docs);
    const inbound = new Map(docs.map((doc) => [doc.slug, 0]));
    for (const entries of graph.values()) {
      for (const entry of entries) {
        inbound.set(entry.slug, (inbound.get(entry.slug) ?? 0) + 1);
      }
    }

    for (const [slug, count] of inbound) {
      expect(count, `${slug} が被リンクゼロで孤立している`).toBeGreaterThan(0);
    }
  });

  it("does not create a new orphan while fixing one", () => {
    const dir = path.resolve(__dirname, "../../content/docs");
    const docs: RelatedInput[] = readdirSync(dir)
      .filter((name) => name.endsWith(".md"))
      .map((name) => {
        const { data } = matter(readFileSync(path.join(dir, name), "utf8"));
        return {
          slug: data.slug as string,
          title: data.title as string,
          description: data.description as string,
        };
      });

    const graph = buildRelatedGraph(docs);
    for (const [slug, entries] of graph) {
      expect(entries, `${slug} のリンク数が上限を超えている`).toHaveLength(3);
      expect(new Set(entries.map((entry) => entry.slug)).size).toBe(entries.length);
      expect(entries.map((entry) => entry.slug)).not.toContain(slug);
    }
  });

  it("is deterministic so builds stay reproducible", () => {
    const first = pickRelated(DOCS, "merge-multiple-parquet-files");
    const second = pickRelated([...DOCS].reverse(), "merge-multiple-parquet-files");
    expect(first.map((doc) => doc.slug)).toEqual(second.map((doc) => doc.slug));
  });

  it("returns nothing for an unknown slug", () => {
    expect(pickRelated(DOCS, "does-not-exist")).toEqual([]);
  });
});
