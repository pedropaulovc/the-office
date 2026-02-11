import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const previewUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "e2e/**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  timeout: 5000,
  expect: {
    timeout: 2000,
  },
  reporter: "html",
  use: {
    baseURL: previewUrl ?? `http://localhost:${process.env.E2E_PORT}`,
    trace: "retain-on-failure",
    actionTimeout: 2000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  // Skip local webServer when running against an external preview URL
  ...(previewUrl
    ? {}
    : {
        webServer: {
          command: "npm run build && npm run start -- -p 0",
          wait: { stdout: /localhost:(?<E2E_PORT>\d+)/ },
          reuseExistingServer: !isCI,
          timeout: 180_000,
        },
      }),
});
