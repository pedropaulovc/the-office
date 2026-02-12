import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const previewUrl = process.env.PLAYWRIGHT_BASE_URL;

// Remote preview deployments have network latency + cold starts.
// Local dev machines run multiple worktrees, dev servers, and MCP servers
// concurrently, so newPage() can take >5 s under I/O pressure.  10 s gives
// enough headroom for browser setup while CI enforces the strict 5 s limit.
const timeout = previewUrl ? 15000 : isCI ? 5000 : 10000;
const actionTimeout = previewUrl ? 5000 : 2000;
const expectTimeout = previewUrl ? 5000 : 2000;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "e2e/**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  // Local dev machines run multiple worktrees sharing CPU/memory.
  // Browser launch can intermittently exceed the test timeout.
  // One retry absorbs these infrastructure hiccups; CI stays strict.
  retries: isCI || previewUrl ? 0 : 1,
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
          command: "npm run start -- -p 0",
          wait: { stdout: /localhost:(?<E2E_PORT>\d+)/ },
          reuseExistingServer: !isCI,
          timeout: 180_000,
        },
      }),
});
