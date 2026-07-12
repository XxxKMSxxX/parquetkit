import { expect, test } from "@playwright/test";

test("home page renders with links to the main tools", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ParquetKit/);
  await expect(
    page.getByRole("heading", { level: 1, name: /entirely in your browser/i }),
  ).toBeVisible();
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: /Parquet Viewer/ })).toBeVisible();
  await expect(main.getByRole("link", { name: /SQL Workbench/ })).toBeVisible();
});
