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
  await page.getByRole("button", { name: "→" }).click();
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
