import path from "node:path";
import { expect, test } from "@playwright/test";

const FIXTURES = path.resolve(__dirname, "../fixtures");

test("opens a Parquet file and shows schema, metadata and data", async ({
  page,
}) => {
  await page.goto("/parquet-viewer");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Parquet Viewer");

  await page
    .getByTestId("file-input")
    .setInputFiles(path.join(FIXTURES, "basic_snappy.parquet"));

  const viewer = page.getByTestId("viewer-result");
  await expect(viewer).toBeVisible();

  // Metadata
  const metadata = page.getByTestId("metadata-panel");
  await expect(metadata).toContainText("100");
  await expect(metadata).toContainText("SNAPPY");

  // Schema
  const schema = page.getByTestId("schema-panel");
  await expect(schema).toContainText("unicode");
  await expect(schema).toContainText("created_at");

  // Data (first page)
  const table = page.getByTestId("data-table");
  await expect(table).toContainText("user_000");
  await expect(table).toContainText("日本語_0_🦆");

  // Pagination (to the second page via multi_rowgroup)
  await page.getByRole("button", { name: "Open another file" }).click();
  await page
    .getByTestId("file-input")
    .setInputFiles(path.join(FIXTURES, "multi_rowgroup.parquet"));
  await expect(page.getByTestId("metadata-panel")).toContainText("5,000");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByTestId("data-table")).toContainText("user_050");
});

test("opens the sample file in one click", async ({ page }) => {
  await page.goto("/parquet-viewer");
  await page.getByRole("button", { name: "Load a sample file" }).click();

  await expect(page.getByTestId("viewer-result")).toBeVisible();
  await expect(page.getByTestId("metadata-panel")).toContainText("5,000");
  await expect(page.getByTestId("schema-panel")).toContainText("ordered_at");
  await expect(page.getByTestId("data-table")).toContainText("100001");
});

test("pagination pack: page size, jump and arrow keys", async ({ page }) => {
  await page.goto("/parquet-viewer");
  await page.getByRole("button", { name: "Load a sample file" }).click();
  await expect(page.getByTestId("viewer-result")).toBeVisible();

  // Metadata shows the writer
  await expect(page.getByTestId("metadata-panel")).toContainText("Created by");

  // 500 rows per page → 5,000 rows = 10 pages
  await page.getByTestId("page-size").selectOption("500");
  await expect(page.getByTestId("viewer-result")).toContainText("/ 10");

  // Jump to page 10 → last order id 105000 is visible
  await page.getByTestId("page-jump").fill("10");
  await expect(page.getByTestId("data-table")).toContainText("105000");

  // Arrow keys page when focus is outside inputs
  await page.getByRole("heading", { name: "Data" }).click();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("page-jump")).toHaveValue("9");

  // ...but not while typing in the page-jump input
  await page.getByTestId("page-jump").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("page-jump")).toHaveValue("9");
});
