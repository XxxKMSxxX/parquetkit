import path from "node:path";
import { expect, test } from "@playwright/test";
import { editorContent, setEditorText } from "./sql-editor";

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
  await expect(editorContent(page)).toHaveText(
    "SELECT * FROM 'basic_snappy.parquet' LIMIT 100",
  );

  // Rewrite to an aggregate query and run it
  await setEditorText(
    page,
    "SELECT count(*)::INTEGER AS total, min(name) AS first_name FROM 'basic_snappy.parquet'",
  );
  await page.getByTestId("run-query").click();

  const result = page.getByTestId("sql-result");
  await expect(result).toBeVisible({ timeout: 30_000 });
  await expect(result).toContainText("1 row");
  await expect(page.getByTestId("data-table")).toContainText("100");
  await expect(page.getByTestId("data-table")).toContainText("user_000");
});

test("queries the sample dataset in one click", async ({ page }) => {
  await page.goto("/sql?duckdb=self");
  await page.getByTestId("sql-sample").click();

  await expect(page.getByTestId("registered-files")).toContainText("demo.parquet");
  await expect(page.getByTestId("sql-result")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("data-table")).toContainText("US");
});

test("runs with Cmd/Ctrl+Enter and shows timing", async ({ page }) => {
  await page.goto("/sql?duckdb=self");
  await page.getByTestId("sql-sample").click();
  await expect(page.getByTestId("sql-result")).toBeVisible({ timeout: 30_000 });

  // ⌘/Ctrl+Enter re-runs the restored query
  await page.getByTestId("sql-editor").click();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByTestId("sql-result")).toContainText("ms");
  await expect(page.getByTestId("sql-result")).toContainText("columns");
});

test("restores the last query after a reload", async ({ page }) => {
  await page.goto("/sql?duckdb=self");
  await setEditorText(page, "SELECT 42 AS answer");
  await page.waitForTimeout(600); // debounce save
  await page.reload();
  await expect(editorContent(page)).toHaveText("SELECT 42 AS answer");
});

test("file chip quick actions run one-click queries", async ({ page }) => {
  await page.goto("/sql?duckdb=self");
  await page.getByTestId("sql-sample").click();
  await expect(page.getByTestId("sql-result")).toBeVisible({ timeout: 30_000 });

  // Stats → SUMMARIZE output has a column_name column
  await page.getByTestId("chip-stats").click();
  await expect(page.getByTestId("data-table")).toContainText("column_name", {
    timeout: 30_000,
  });

  // Clicking the file name inserts it at the cursor
  await setEditorText(page, "SELECT * FROM ");
  await page.getByRole("button", { name: "demo.parquet", exact: true }).click();
  await expect(editorContent(page)).toHaveText("SELECT * FROM 'demo.parquet'");
});
