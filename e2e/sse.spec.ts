import { test, expect } from "@playwright/test";

test.describe("SSE real-time events", () => {
  test("message broadcast via SSE appears in the UI", async ({ page }) => {
    // The in-memory connectionRegistry doesn't share state across Vercel
    // serverless function instances (GET /api/sse vs POST /api/sse/test).
    // Instead, intercept the SSE connection via Playwright and inject the
    // test event directly — this tests the full client-side SSE pipeline.

    const testText = `SSE test ${Date.now()}`;
    const event = {
      type: "message_created",
      channelId: "general",
      data: {
        id: crypto.randomUUID(),
        channelId: "general",
        userId: "dwight",
        text: testText,
        createdAt: new Date().toISOString(),
      },
    };

    // Hold the SSE connection until we're ready to deliver the event
    let deliverEvent!: () => void;
    const eventReady = new Promise<void>((resolve) => {
      deliverEvent = resolve;
    });
    let intercepted = false;

    await page.route("**/api/sse", async (route) => {
      if (intercepted) {
        await route.continue();
        return;
      }
      intercepted = true;
      await eventReady;
      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
        },
        body: `: connected\n\ndata: ${JSON.stringify(event)}\n\n`,
      });
    });

    // 1. Open the app — default view is #general
    await page.goto("/");

    // 2. Wait for initial messages to load (avoids overwrite race condition)
    const authorNames = page.locator(".font-bold.text-sm.text-gray-900");
    await expect(authorNames.first()).toBeVisible();

    // 3. Deliver the SSE event now that initial state is settled
    deliverEvent();

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
