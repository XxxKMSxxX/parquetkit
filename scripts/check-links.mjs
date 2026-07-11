// out/ 内の全HTMLを走査し、内部リンク(href/src)が実在するかを検証する。
// コンテンツ追加で壊れたリンクが本番に出るのを防ぐ品質ゲート。
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve("out");

function collectHtml(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectHtml(full);
    return entry.name.endsWith(".html") ? [full] : [];
  });
}

function resolveTarget(url) {
  const clean = url.split(/[#?]/)[0];
  if (clean === "") return true;
  const abs = path.join(OUT, clean);
  if (existsSync(abs) && !statSync(abs).isDirectory()) return true;
  return existsSync(`${abs}.html`) || existsSync(path.join(abs, "index.html"));
}

if (!existsSync(OUT)) {
  console.error("out/ がありません。先に pnpm build を実行してください。");
  process.exit(1);
}

const errors = [];
for (const file of collectHtml(OUT)) {
  const html = readFileSync(file, "utf8");
  for (const match of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    const url = match[1];
    if (url.startsWith("//")) continue;
    if (!resolveTarget(url)) {
      errors.push(`${path.relative(OUT, file)} -> ${url}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`内部リンク切れ ${errors.length} 件:`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log("内部リンク切れなし");
