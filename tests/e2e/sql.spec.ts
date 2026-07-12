import path from "node:path";
import { expect, test } from "@playwright/test";

const FIXTURES = path.resolve(__dirname, "../fixtures");

test("registers a file, runs SQL and shows the results", async ({ page }) => {
  // ?duckdb=self uses the self-hosted bundles (no external network dependency in CI)
  await page.goto("/sql?duckdb=self");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("SQL Workbench");

  await page
    .getByTestId("file-input")
    .setInputFiles(path.join(FIXTURES, "basic_snappy.parquet"));

  await expect(page.getByTestId("registered-files")).toContainText(
    "basic_snappy.parquet",
  );

  // The default SQL is filled in
  const editor = page.getByTestId("sql-editor");
  await expect(editor).toHaveValue(
    "SELECT * FROM 'basic_snappy.parquet' LIMIT 100",
  );

  // Rewrite to an aggregate query and run it
  await editor.fill(
    "SELECT count(*)::INTEGER AS total, min(name) AS first_name FROM 'basic_snappy.parquet'",
  );
  await page.getByTestId("run-query").click();

  const result = page.getByTestId("sql-result");
  await expect(result).toBeVisible({ timeout: 30_000 });
  await expect(result).toContainText("1 row");
  await expect(page.getByTestId("data-table")).toContainText("100");
  await expect(page.getByTestId("data-table")).toContainText("user_000");
});
