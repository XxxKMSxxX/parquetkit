// Scan every HTML file in out/ and verify that internal links (href/src) resolve.
// Quality gate that keeps links broken by new content out of production.
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
  console.error("out/ not found. Run pnpm build first.");
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
  console.error(`${errors.length} broken internal link(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log("No broken internal links");
