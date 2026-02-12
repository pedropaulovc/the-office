import { test, expect } from "@playwright/test";

test.describe("compose flow", () => {
  test("POST /api/messages returns 201 for valid, 400 for invalid", async ({
    request,
  }) => {
    // Valid
    const unique = `compose-valid-${Date.now()}`;
    const validRes = await request.post("/api/messages", {
      data: { channelId: "general", userId: "michael", text: unique },
    });
    expect(validRes.status()).toBe(201);

    const msg = (await validRes.json()) as { id: string };

    // Invalid: missing text
    const invalidRes = await request.post("/api/messages", {
      data: { channelId: "general", userId: "michael", text: "" },
    });
    expect(invalidRes.status()).toBe(400);

    // Cleanup
    await request.delete(`/api/messages/${msg.id}`);
  });

  test("ComposeBox textarea is visible and functional", async ({ page }) => {
    await page.goto("/");

    // Wait for app to load
    const authorNames = page.locator(".font-bold.text-sm.text-gray-900");
    await expect(authorNames.first()).toBeVisible();

    // Textarea should be visible with the correct placeholder
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute("placeholder", "Message #general");

    // Should be typeable
    await textarea.fill("test input");
    await expect(textarea).toHaveValue("test input");
  });

  test("type message + Enter clears input and message appears", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for messages to load
    const authorNames = page.locator(".font-bold.text-sm.text-gray-900");
    await expect(authorNames.first()).toBeVisible();

    const unique = `compose-enter-${Date.now()}`;
    const textarea = page.locator("textarea");
    await textarea.fill(unique);
    await textarea.press("Enter");

    // Input should clear
    await expect(textarea).toHaveValue("");

    // Message should appear in the chat via SSE
    await expect(page.getByText(unique)).toBeVisible();
  });

  test("send button disabled when textarea is empty", async ({ page }) => {
    await page.goto("/");

    // Wait for app to load
    const authorNames = page.locator(".font-bold.text-sm.text-gray-900");
    await expect(authorNames.first()).toBeVisible();

    const sendButton = page.getByRole("button", { name: "send" });
    await expect(sendButton).toBeVisible();
    await expect(sendButton).toBeDisabled();

    // Type something — button should enable
    const textarea = page.locator("textarea");
    await textarea.fill("not empty");
    await expect(sendButton).toBeEnabled();

    // Clear — button should disable again
    await textarea.fill("");
    await expect(sendButton).toBeDisabled();
  });
});
