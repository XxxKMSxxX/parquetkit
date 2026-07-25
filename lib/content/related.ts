/**
 * 記事間の関連度を算出して内部リンク先を選ぶ。
 *
 * 全記事から一律に先頭N件を出すと、リンクを受ける記事が偏り、残りが被リンク
 * ゼロのまま埋もれる。トピックが近い記事同士を相互に繋ぐことで、記事が増えても
 * 手当てなしにクラスタが育つ(週次の自動生成記事にもそのまま効く)。
 *
 * スコアはTF-IDFの内積。"parquet" のようにほぼ全記事へ出る語はIDFで自動的に
 * 効かなくなるため、語のブラックリストを保守する必要がない。
 */

export type RelatedInput = {
  slug: string;
  title: string;
  description: string;
};

/** 英語の機能語。IDFでもある程度落ちるが、短文では残りやすいので明示的に除く */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "cannot",
  "do", "does", "each", "for", "from", "get", "has", "have", "here", "how",
  "in", "into", "is", "it", "its", "not", "of", "on", "one", "or", "out",
  "over", "own", "same", "see", "so", "than", "that", "the", "their", "them",
  "then", "there", "these", "this", "to", "up", "use", "using", "want", "was",
  "way", "ways", "what", "when", "where", "which", "who", "why", "will",
  "with", "without", "you", "your",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

/**
 * slugは記事の主題そのものなので重く、descriptionは補助情報なので軽く見る。
 * 重みは経験的なもので、順位付けにしか使わないため厳密な較正は不要。
 */
const FIELD_WEIGHTS = { slug: 3, title: 2, description: 1 } as const;

function termWeights(doc: RelatedInput): Map<string, number> {
  const weights = new Map<string, number>();
  for (const [field, weight] of Object.entries(FIELD_WEIGHTS) as [
    keyof typeof FIELD_WEIGHTS,
    number,
  ][]) {
    for (const token of tokenize(doc[field])) {
      weights.set(token, (weights.get(token) ?? 0) + weight);
    }
  }
  return weights;
}

function inverseDocumentFrequency(docs: RelatedInput[]): Map<string, number> {
  const documentFrequency = new Map<string, number>();
  for (const doc of docs) {
    for (const token of new Set(termWeights(doc).keys())) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [token, count] of documentFrequency) {
    // 全記事に出る語は0になり、内積へ寄与しなくなる
    idf.set(token, Math.log(docs.length / count));
  }
  return idf;
}

function similarity(
  a: Map<string, number>,
  b: Map<string, number>,
  idf: Map<string, number>,
): number {
  let score = 0;
  for (const [token, weightA] of a) {
    const weightB = b.get(token);
    if (weightB === undefined) continue;
    const tokenIdf = idf.get(token) ?? 0;
    score += weightA * weightB * tokenIdf * tokenIdf;
  }
  return score;
}

/**
 * 全記事分の内部リンク先を一度に決める。
 *
 * 関連度順に上位を選ぶだけだと、どこからもリンクされない記事が残る(実際に
 * エラーメッセージ系の記事が孤立した)。孤立ページは内部リンクの恩恵を全く
 * 受けないため、選定後に孤立を解消する。リンクは相互である必要がないので、
 * 「最も関連の近い記事のリスト」へ割り込ませることで解消できる。
 */
export function buildRelatedGraph(
  docs: RelatedInput[],
  limit = 3,
): Map<string, RelatedInput[]> {
  const idf = inverseDocumentFrequency(docs);
  const weights = new Map(docs.map((doc) => [doc.slug, termWeights(doc)]));

  const score = (from: string, to: string): number =>
    similarity(weights.get(from)!, weights.get(to)!, idf);

  // 関連度が同じ場合はslugの辞書順で決める(ビルドの再現性を保つため)
  const rankedFor = (slug: string): { doc: RelatedInput; score: number }[] =>
    docs
      .filter((doc) => doc.slug !== slug)
      .map((doc) => ({ doc, score: score(slug, doc.slug) }))
      .sort((a, b) => b.score - a.score || a.doc.slug.localeCompare(b.doc.slug));

  const graph = new Map<string, { doc: RelatedInput; score: number }[]>(
    docs.map((doc) => [doc.slug, rankedFor(doc.slug).slice(0, limit)]),
  );

  const inbound = new Map(docs.map((doc) => [doc.slug, 0]));
  for (const entries of graph.values()) {
    for (const entry of entries) {
      inbound.set(entry.doc.slug, (inbound.get(entry.doc.slug) ?? 0) + 1);
    }
  }

  const orphans = docs
    .filter((doc) => inbound.get(doc.slug) === 0)
    .sort((a, b) => a.slug.localeCompare(b.slug));

  for (const orphan of orphans) {
    // 孤立記事に最も近い記事から順に、割り込ませられる枠を探す。
    // 押し出す相手の被リンクが1本しかない場合は新たな孤立を生むので選ばない。
    for (const host of rankedFor(orphan.slug)) {
      const entries = graph.get(host.doc.slug)!;
      const weakest = [...entries]
        .filter((entry) => (inbound.get(entry.doc.slug) ?? 0) >= 2)
        .sort((a, b) => a.score - b.score || b.doc.slug.localeCompare(a.doc.slug))[0];
      if (!weakest) continue;

      graph.set(host.doc.slug, [
        ...entries.filter((entry) => entry.doc.slug !== weakest.doc.slug),
        { doc: orphan, score: score(host.doc.slug, orphan.slug) },
      ]);
      inbound.set(weakest.doc.slug, inbound.get(weakest.doc.slug)! - 1);
      inbound.set(orphan.slug, 1);
      break;
    }
  }

  return new Map(
    [...graph].map(([slug, entries]) => [slug, entries.map((entry) => entry.doc)]),
  );
}

/** グラフ全体を毎ページ再計算しないためのキャッシュ(ビルド時のみ使われる) */
let cache: { key: string; graph: Map<string, RelatedInput[]> } | null = null;

/** `slug` の記事に対する内部リンク先を返す。未知のslugでは空配列。 */
export function pickRelated(
  docs: RelatedInput[],
  slug: string,
  limit = 3,
): RelatedInput[] {
  const key = `${limit}:${docs.map((doc) => doc.slug).join(",")}`;
  if (cache?.key !== key) {
    cache = { key, graph: buildRelatedGraph(docs, limit) };
  }
  return cache.graph.get(slug) ?? [];
}
