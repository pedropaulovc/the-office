import playwright from "eslint-plugin-playwright";
import js from "@eslint/js";
import reactRefresh from "eslint-plugin-react-refresh";
import nextConfig from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [".next/**/*", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "coverage/**"] },
  ...nextConfig,
  {
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowBoolean: true,
          allowNullish: true,
          allowNumber: true,
        },
      ],
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    files: ["src/app/**/layout.tsx", "src/app/**/page.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["*.config.ts", "*.config.js", "*.config.mjs", "playwright.config.ts"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ["e2e/**/*.spec.ts"],
    extends: [playwright.configs["flat/recommended"]],
    rules: {
      "playwright/no-skipped-test": "error",
      "playwright/no-conditional-in-test": "error",
    },
  },
);
