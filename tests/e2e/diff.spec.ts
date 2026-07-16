import path from "node:path";
import { expect, test } from "@playwright/test";

const FIXTURES = path.resolve(__dirname, "../fixtures");

test("comparing two parquet files shows schema diff, summary counts and detail tabs", async ({
  page,
}) => {
  await page.goto("/diff?duckdb=self");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Parquet Diff");

  await page
    .getByTestId("file-input")
    .setInputFiles([
      path.join(FIXTURES, "diff_left.parquet"),
      path.join(FIXTURES, "diff_right.parquet"),
    ]);

  // Schemas are identical for this pair; the key guess should land on `id`
  await expect(page.getByTestId("diff-schema")).toContainText("Schemas are identical");
  await expect(page.getByTestId("diff-key-select")).toHaveValue("id");

  await page.getByTestId("run-diff").click();

  const summary = page.getByTestId("diff-summary");
  await expect(summary).toBeVisible({ timeout: 30_000 });
  await expect(summary).toContainText("Added");
  await expect(page.getByTestId("diff-tab-added")).toContainText("Added (3)");
  await expect(page.getByTestId("diff-tab-removed")).toContainText("Removed (2)");
  await expect(page.getByTestId("diff-tab-changed")).toContainText("Changed (4)");

  // First non-empty tab (added) is opened automatically
  await expect(page.getByTestId("diff-rows")).toContainText("user_100");

  // Changed rows render as old → new
  await page.getByTestId("diff-tab-changed").click();
  await expect(page.getByTestId("diff-rows")).toContainText("user_003 → renamed_003", {
    timeout: 15_000,
  });
});

test("compares the sample files in one click", async ({ page }) => {
  await page.goto("/diff?duckdb=self");
  await page.getByTestId("diff-sample").click();

  await expect(page.getByTestId("diff-schema")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("run-diff").click();
  await expect(page.getByTestId("diff-summary")).toBeVisible({ timeout: 30_000 });
});

test("schema drift is reported before running the row diff", async ({ page }) => {
  await page.goto("/diff?duckdb=self");
  await page
    .getByTestId("file-input")
    .setInputFiles([
      path.join(FIXTURES, "diff_left.parquet"),
      path.join(FIXTURES, "diff_schema_right.parquet"),
    ]);

  const schema = page.getByTestId("diff-schema");
  await expect(schema).toContainText("region");
  await expect(schema).toContainText("nullable");
  await expect(schema).toContainText("score");
});
