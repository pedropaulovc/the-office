import { test, expect } from "@playwright/test";

test.describe("SSE real-time events", () => {
  test("message broadcast via SSE appears in the UI", async ({
    page,
    request,
  }) => {
    // 1. Open the app -- default view is #general
    await page.goto("/");

    // 2. Wait for initial messages to load
    const authorNames = page.locator(".font-bold.text-sm.text-gray-900");
    await expect(authorNames.first()).toBeVisible();

    // 3. POST a test SSE event for #general
    const testText = `SSE test ${Date.now()}`;
    const res = await request.post("/api/sse/test", {
      data: {
        channelId: "general",
        userId: "dwight",
        text: testText,
      },
    });
    expect(res.status()).toBe(200);

    // 4. Verify the new message appears in the UI
    await expect(page.getByText(testText)).toBeVisible();
  });

  test("SSE endpoint returns event-stream content type", async ({ page }) => {
    await page.goto("/");

    // Use fetch with AbortController to check headers without waiting for
    // the full (infinite) SSE response body.
    const contentType = await page.evaluate(async () => {
      const controller = new AbortController();
      const res = await fetch("/api/sse", { signal: controller.signal });
      const ct = res.headers.get("content-type");
      controller.abort();
      return ct;
    });

    expect(contentType).toContain("text/event-stream");
  });
});
