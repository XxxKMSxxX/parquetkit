import { expect, test } from "@playwright/test";

test("docs article shows a table of contents with working anchors", async ({
  page,
}) => {
  await page.goto("/docs/query-parquet-with-sql-in-browser");
  const toc = page.getByTestId("toc");
  await expect(toc).toBeVisible();
  await expect(toc).toContainText("Recipes");
  await expect(toc).toContainText("Frequently asked questions");

  await toc.getByRole("link", { name: "Recipes" }).click();
  await expect(page).toHaveURL(/#recipes$/);
  await expect(page.locator("#recipes")).toBeInViewport();
});

test("convert page shows a table of contents", async ({ page }) => {
  await page.goto("/convert/parquet-to-csv");
  const toc = page.getByTestId("toc");
  await expect(toc).toBeVisible();
  await expect(toc).toContainText("How this converter works");
});
