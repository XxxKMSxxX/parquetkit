import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const FIXTURES = path.resolve(__dirname, "../fixtures");

test("parquet→csv変換でダウンロードされたCSVの内容が正しい", async ({ page }) => {
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
