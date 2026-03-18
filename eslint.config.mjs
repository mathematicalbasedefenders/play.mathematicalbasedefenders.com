// @ts-check

import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  eslint.configs.recommended,
  tseslint.configs.recommended,
  globalIgnores([
    "**/*/tests/*",
    "**/*/cypress/**/*",
    "client/src/public/lib/*",
    "client/webpack.config.development.js",
    "client/webpack.config.production.js",
    "**/*/anticheat.ts",
    "**/*/disabled-anticheat.ts"
  ]),
  {
    rules: {
      "prefer-const": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-empty-object-type": "off"
    }
  }
]);
