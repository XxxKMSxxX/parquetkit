import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // lib/engine/ はReact/DOM/Next非依存の純TS層。将来のnpm切り出し・CLI化と
    // vitest(node)での直接テストを保証するため、UI系パッケージのimportを禁止する
    files: ["lib/engine/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "react/*", "react-dom/*", "next", "next/*"],
              message: "lib/engine/ はUI非依存の純TS層。React/Next への依存は禁止。",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
    // self-host用にコピーされるDuckDB-WASMのvendorファイル(gitignore済み)
    "public/duckdb/**",
  ]),
]);

export default eslintConfig;
