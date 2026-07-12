import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // lib/engine/ is a pure TS layer with no React/DOM/Next dependency. UI imports are
    // banned to keep it extractable as an npm package / CLI and directly testable in vitest (node)
    files: ["lib/engine/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "react/*", "react-dom/*", "next", "next/*"],
              message: "lib/engine/ is a UI-free pure TS layer. React/Next dependencies are banned.",
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
    // DuckDB-WASM vendor files copied for self-hosting (gitignored)
    "public/duckdb/**",
    // Standalone npm package placeholder, not part of the Next.js app
    "packages/**",
  ]),
]);

export default eslintConfig;
