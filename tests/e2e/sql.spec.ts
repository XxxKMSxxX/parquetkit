import path from "node:path";
import { expect, test } from "@playwright/test";

const FIXTURES = path.resolve(__dirname, "../fixtures");

test("ファイルを登録してSQLを実行し結果が表示される", async ({ page }) => {
  // ?duckdb=self でself-hostedバンドルを使用(CIの外部ネットワーク依存を排除)
  await page.goto("/sql?duckdb=self");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("SQL Workbench");

  await page
    .getByTestId("file-input")
    .setInputFiles(path.join(FIXTURES, "basic_snappy.parquet"));

  await expect(page.getByTestId("registered-files")).toContainText(
    "basic_snappy.parquet",
  );

  // デフォルトSQLが補完される
  const editor = page.getByTestId("sql-editor");
  await expect(editor).toHaveValue(
    "SELECT * FROM 'basic_snappy.parquet' LIMIT 100",
  );

  // 集計クエリに書き換えて実行
  await editor.fill(
    "SELECT count(*)::INTEGER AS total, min(name) AS first_name FROM 'basic_snappy.parquet'",
  );
  await page.getByTestId("run-query").click();

  const result = page.getByTestId("sql-result");
  await expect(result).toBeVisible({ timeout: 30_000 });
  await expect(result).toContainText("1 row");
  await expect(page.getByTestId("data-table")).toContainText("100");
  await expect(page.getByTestId("data-table")).toContainText("user_000");
});
