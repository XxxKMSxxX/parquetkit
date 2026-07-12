// Records the homepage hero demo: the sample dataset opening in the viewer.
//
// The video is displayed at ~880px wide on the homepage, so it is recorded at
// a 960px-wide viewport (≈0.92x display scale) with a 2x device scale factor —
// this keeps the app's UI text readable in the rendered video, which a
// full-desktop recording scaled down does not.
//
// Prerequisites: `pnpm build` (serves the static export in out/), ffmpeg,
// and uv (poster conversion via Pillow).
//
// Usage: node scripts/record-hero-demo.mjs
import { chromium } from "@playwright/test";
import { spawn, execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FPS = 1.5; // input framerate: each captured frame is held ~0.67s
const frameDir = mkdtempSync(join(tmpdir(), "hero-demo-"));
const server = spawn("pnpm", ["exec", "serve", "-l", "4173", "out"], {
  stdio: "ignore",
});

try {
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 2,
  });

  let frame = 0;
  const capture = async (count = 1) => {
    for (let i = 0; i < count; i++) {
      await page.screenshot({
        path: join(frameDir, `frame-${String(frame++).padStart(3, "0")}.png`),
      });
    }
  };

  await page.goto("http://localhost:4173/parquet-viewer", {
    waitUntil: "networkidle",
  });

  // The drop zone, then the sample file opening
  await capture(2);
  await page.getByRole("button", { name: "Load a sample file" }).click();
  await page.getByTestId("data-table").waitFor();
  await page.waitForTimeout(300);

  // Schema, metadata and the first rows
  await capture(4);

  // Scroll through the data
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(150);
    await capture(1);
  }

  // Hold the final state so the loop does not feel abrupt
  await capture(2);

  await browser.close();

  // faststart puts the moov atom first so playback starts before the file
  // finishes downloading — without it the video delays the homepage LCP
  execSync(
    `ffmpeg -y -framerate ${FPS} -i "${frameDir}/frame-%03d.png" ` +
      `-c:v libx264 -pix_fmt yuv420p -crf 30 -r 30 -vf scale=1600:-2 ` +
      `-movflags +faststart public/hero-demo.mp4`,
    { stdio: "inherit" },
  );
  // The poster is the LCP element — keep it light (1280w is enough for the
  // ~1s it is visible before the video takes over)
  execSync(
    `uv run --with pillow python -c "` +
      `from PIL import Image; ` +
      `im = Image.open('${frameDir}/frame-000.png'); ` +
      `im.thumbnail((1280, 720)); ` +
      `im.save('public/hero-demo-poster.webp', quality=70, method=6)"`,
    { stdio: "inherit" },
  );
  console.log("Wrote public/hero-demo.mp4 and public/hero-demo-poster.webp");
} finally {
  server.kill();
  rmSync(frameDir, { recursive: true, force: true });
}
