import { test, expect } from "@playwright/test";

test.describe("messages UI rendering", () => {
  test("channel sidebar renders channels from DB", async ({ page }) => {
    await page.goto("/");

    const sidebar = page.locator("aside").nth(1);

    // Check that known channels render
    await expect(sidebar.getByText("general")).toBeVisible();
    await expect(sidebar.getByText("sales")).toBeVisible();
    await expect(sidebar.getByText("party-planning")).toBeVisible();
    await expect(sidebar.getByText("announcements")).toBeVisible();
    await expect(sidebar.getByText("random")).toBeVisible();
  });

  test("switching channels loads correct messages", async ({ page }) => {
    await page.goto("/");

    // Should start on #general — wait for messages to load
    const messageArea = page.locator(".font-bold.text-sm.text-gray-900");
    await expect(messageArea.first()).toBeVisible();

    // Switch to #sales
    const sidebar = page.locator("aside").nth(1);
    await sidebar.getByText("sales").click();

    // Wait for sales messages to load — look for a known sales message author
    await expect(
      page.getByText("Lackawanna County", { exact: false }),
    ).toBeVisible();
  });

  test("DM list renders for current user", async ({ page }) => {
    await page.goto("/");

    const sidebar = page.locator("aside").nth(1);

    // Michael is the default user; should see his DMs
    await expect(sidebar.getByText("Direct Messages")).toBeVisible();

    // Michael has DMs with Jim, Dwight, Toby, Ryan
    await expect(sidebar.getByText("Jim Halpert")).toBeVisible();
  });

  test("thread panel opens and shows replies", async ({ page }) => {
    await page.goto("/");

    // Wait for messages to load
    const messageArea = page.locator(".font-bold.text-sm.text-gray-900");
    await expect(messageArea.first()).toBeVisible();

    // Find a message with thread reply count > 0 and click "replies"
    const threadButton = page.getByRole("button", { name: /\d+ repl/i }).first();
    await expect(threadButton).toBeVisible();
    await threadButton.click();

    // Thread panel should open with reply count visible
    const threadPanel = page.locator(".border-slack-thread-border");
    await expect(threadPanel).toBeVisible();
    await expect(threadPanel.getByText(/\d+ repl/)).toBeVisible();
  });

  test("private channels filtered by membership", async ({ page }) => {
    await page.goto("/");

    const sidebar = page.locator("aside").nth(1);

    // Michael is a member of #management (private) — should see it
    await expect(sidebar.getByText("management")).toBeVisible();

    // Michael is NOT a member of #accounting (private) — should not see it
    await expect(sidebar.getByText("accounting")).toBeHidden();
  });
});
