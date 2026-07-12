import { expect, test } from "@playwright/test";

test("hands the loaded file off from the viewer to the SQL workbench", async ({
  page,
}) => {
  // ?duckdb=self must survive the handoff so CI never hits the CDN
  await page.goto("/parquet-viewer?duckdb=self");
  await page.getByRole("button", { name: "Load a sample file" }).click();
  await expect(page.getByTestId("viewer-result")).toBeVisible();

  await page.getByTestId("open-in-sql").click();
  await expect(page).toHaveURL(/\/sql\?duckdb=self/);
  await expect(page.getByTestId("registered-files")).toContainText(
    "demo.parquet",
    { timeout: 30_000 },
  );
  await expect(page.getByTestId("sql-editor")).toHaveValue(/demo\.parquet/);
});
