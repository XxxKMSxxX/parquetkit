import { expect, test } from "@playwright/test";

test("トップページが表示され主要ツールへのリンクがある", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ParquetKit/);
  await expect(
    page.getByRole("heading", { level: 1, name: /entirely in your browser/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Parquet Viewer/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /SQL Workbench/ })).toBeVisible();
});
