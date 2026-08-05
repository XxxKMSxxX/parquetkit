import { expect, test } from "@playwright/test";

test("home page renders with links to the main tools", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ParquetKit/);
  await expect(
    page.getByRole("heading", { level: 1, name: /entirely in your browser/i }),
  ).toBeVisible();
  // ガイド記事のタイトルにもツール名が現れるため、ツールカードのregionに限定する
  const tools = page.getByRole("region", { name: "Tools" });
  await expect(
    tools.getByRole("link", { name: /Parquet Viewer/ }),
  ).toBeVisible();
  await expect(
    tools.getByRole("link", { name: /SQL Workbench/ }),
  ).toBeVisible();
});
