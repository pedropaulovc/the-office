import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    onConsoleLog: () => false,
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/"],
    coverage: {
      provider: "v8",
      reporter: ["json", "json-summary", "html"],
      include: ["src/utils/**", "src/features/**", "src/lib/**", "src/agents/**"],
      exclude: [
        "node_modules/",
        "e2e/",
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
        "**/index.ts",
        "**/*.yaml",
        "**/*.yml",
        "**/*.md",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
