// Records the product demos: the homepage hero video and the README GIFs.
//
// Everything is recorded at a 960px-wide viewport (≈0.9x display scale) with
// a 2x device scale factor — this keeps the app's UI text readable in the
// rendered assets, which a full-desktop recording scaled down does not.
//
// Prerequisites: `pnpm build` (serves the static export in out/), ffmpeg,
// and uv (poster conversion via Pillow).
//
// Usage: node scripts/record-demos.mjs
import { chromium } from "@playwright/test";
import { spawn, execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FPS = 1.5; // input framerate: each captured frame is held ~0.67s
const server = spawn("pnpm", ["exec", "serve", "-l", "4173", "out"], {
  stdio: "ignore",
});

// GitHub caps README media; a diff-optimized palette keeps the GIFs small
const gifFilter =
  "scale=1200:-2:flags=lanczos,split[a][b];" +
  "[a]palettegen=stats_mode=diff[p];" +
  "[b][p]paletteuse=dither=bayer:bayer_scale=3";

function makeRecorder(page, frameDir) {
  let frame = 0;
  return async (count = 1) => {
    for (let i = 0; i < count; i++) {
      await page.screenshot({
        path: join(frameDir, `frame-${String(frame++).padStart(3, "0")}.png`),
      });
    }
  };
}

const viewerDir = mkdtempSync(join(tmpdir(), "demo-viewer-"));
const sqlDir = mkdtempSync(join(tmpdir(), "demo-sql-"));

try {
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 2,
  });

  // --- Viewer: the drop zone, then the sample file opening ---
  const captureViewer = makeRecorder(page, viewerDir);
  await page.goto("http://localhost:4173/parquet-viewer", {
    waitUntil: "networkidle",
  });
  await captureViewer(2);
  await page.getByRole("button", { name: "Load a sample file" }).click();
  await page.getByTestId("data-table").waitFor();
  await page.waitForTimeout(300);

  // Schema, metadata and the first rows
  await captureViewer(4);

  // Scroll through the data
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(150);
    await captureViewer(1);
  }

  // Hold the final state so the loop does not feel abrupt
  await captureViewer(2);

  // --- SQL Workbench: one-click sample query ---
  const captureSql = makeRecorder(page, sqlDir);
  await page.goto("http://localhost:4173/sql?duckdb=self", {
    waitUntil: "networkidle",
  });
  await captureSql(2);
  await page.getByTestId("sql-sample").click();
  await page.getByTestId("sql-result").waitFor({ timeout: 30_000 });
  await page.waitForTimeout(300);
  await captureSql(4);
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(150);
  await captureSql(3);

  await browser.close();

  // Hero video: faststart puts the moov atom first so playback starts before
  // the file finishes downloading — without it the video delays the LCP
  execSync(
    `ffmpeg -y -framerate ${FPS} -i "${viewerDir}/frame-%03d.png" ` +
      `-c:v libx264 -pix_fmt yuv420p -crf 30 -r 30 -vf scale=1600:-2 ` +
      `-movflags +faststart public/hero-demo.mp4`,
    { stdio: "inherit" },
  );
  // The poster is the LCP element — keep it light (1280w is enough for the
  // ~1s it is visible before the video takes over)
  execSync(
    `uv run --with pillow python -c "` +
      `from PIL import Image; ` +
      `im = Image.open('${viewerDir}/frame-000.png'); ` +
      `im.thumbnail((1280, 720)); ` +
      `im.save('public/hero-demo-poster.webp', quality=70, method=6)"`,
    { stdio: "inherit" },
  );
  // README GIFs, from the same recordings
  execSync(
    `ffmpeg -y -framerate ${FPS} -i "${viewerDir}/frame-%03d.png" ` +
      `-vf "${gifFilter}" .github/demo.gif`,
    { stdio: "inherit" },
  );
  execSync(
    `ffmpeg -y -framerate ${FPS} -i "${sqlDir}/frame-%03d.png" ` +
      `-vf "${gifFilter}" .github/demo-sql.gif`,
    { stdio: "inherit" },
  );
  console.log(
    "Wrote public/hero-demo.mp4, public/hero-demo-poster.webp, .github/demo.gif, .github/demo-sql.gif",
  );
} finally {
  server.kill();
  rmSync(viewerDir, { recursive: true, force: true });
  rmSync(sqlDir, { recursive: true, force: true });
}
