import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const previewUrl = process.env.PLAYWRIGHT_BASE_URL;

// Remote preview deployments have network latency + cold starts
const timeout = previewUrl ? 15000 : 5000;
const actionTimeout = previewUrl ? 5000 : 2000;
const expectTimeout = previewUrl ? 5000 : 2000;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "e2e/**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  timeout,
  expect: {
    timeout: expectTimeout,
  },
  reporter: "html",
  use: {
    baseURL: previewUrl ?? `http://localhost:${process.env.E2E_PORT}`,
    trace: "retain-on-failure",
    actionTimeout,
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
