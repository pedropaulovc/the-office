import { test, expect } from "@playwright/test";

test.describe("agents UI rendering", () => {
  test("user switcher shows agents from database", async ({ page }) => {
    await page.goto("/");

    // WorkspaceSidebar renders agent avatar buttons
    const sidebar = page.locator("aside").first();
    const avatarButtons = sidebar.locator("button[title]").filter({
      hasNot: page.locator('button[title="Dunder Mifflin"]'),
    });

    // Should have at least 16 agents (the seeded ones)
    await expect(avatarButtons.first()).toBeVisible();
    const count = await avatarButtons.count();
    expect(count).toBeGreaterThanOrEqual(16);

    // Michael Scott should be the first agent (active by default)
    const michaelBtn = sidebar.locator('button[title="Michael Scott (you)"]');
    await expect(michaelBtn).toBeVisible();
  });

  test("message author names render from agent data", async ({ page }) => {
    await page.goto("/");

    // Wait for the message list to load
    const messageArea = page.locator(".font-bold.text-sm.text-gray-900");
    await expect(messageArea.first()).toBeVisible();

    // Check that at least one message shows a known agent name
    const allNames = await messageArea.allTextContents();
    const knownNames = [
      "Michael Scott",
      "Jim Halpert",
      "Dwight Schrute",
      "Pam Beesly",
    ];
    const hasKnownName = allNames.some((name) =>
      knownNames.some((known) => name.includes(known)),
    );
    expect(hasKnownName).toBe(true);
  });

  test("switching user updates the active avatar", async ({ page }) => {
    await page.goto("/");

    const sidebar = page.locator("aside").first();

    // Jim's button should not have the "(you)" suffix initially
    const jimBtn = sidebar.locator('button[title="Jim Halpert"]');
    await expect(jimBtn).toBeVisible();

    // Click Jim to switch
    await jimBtn.click();

    // Now Jim should be "(you)"
    const jimActiveBtn = sidebar.locator('button[title="Jim Halpert (you)"]');
    await expect(jimActiveBtn).toBeVisible();
  });
});
