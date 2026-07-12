import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const FIXTURES = path.resolve(__dirname, "../fixtures");

test("parquet→csv conversion downloads a CSV with the correct contents", async ({ page }) => {
  await page.goto("/convert/parquet-to-csv?duckdb=self");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Convert Parquet to CSV",
  );

  const downloadPromise = page.waitForEvent("download");
  await page
    .getByTestId("file-input")
    .setInputFiles(path.join(FIXTURES, "basic_snappy.parquet"));

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("basic_snappy.csv");

  const savedPath = await download.path();
  const text = readFileSync(savedPath, "utf8");
  const [header, firstRow] = text.split("\n");
  expect(header.split(",")).toEqual(
    expect.arrayContaining(["id", "name", "unicode", "balance"]),
  );
  expect(firstRow).toContain("user_000");

  await expect(page.getByTestId("convert-result")).toContainText("basic_snappy.csv");
});

test("converts the sample file in one click", async ({ page }) => {
  await page.goto("/convert/parquet-to-csv?duckdb=self");
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("convert-sample").click();

  await expect(page.getByTestId("convert-result")).toBeVisible({ timeout: 30_000 });
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("demo.csv");
});

test("converts multiple files in one batch", async ({ page }) => {
  await page.goto("/convert/parquet-to-csv?duckdb=self");
  await page
    .getByTestId("file-input")
    .setInputFiles([
      path.join(FIXTURES, "basic_snappy.parquet"),
      path.join(FIXTURES, "multi_rowgroup.parquet"),
    ]);

  const result = page.getByTestId("convert-result");
  await expect(result).toContainText("2 files converted", { timeout: 30_000 });
  await expect(result).toContainText("basic_snappy.csv");
  await expect(result).toContainText("multi_rowgroup.csv");

  const downloadPromise = page.waitForEvent("download");
  await result.getByRole("link", { name: "Download", exact: true }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("basic_snappy.csv");
});
