import { test, expect } from "@playwright/test";

test.describe("dashboard shell & tab switcher", () => {
  test("tab bar renders with Slack and Dashboard tabs", async ({ page }) => {
    await page.goto("/");

    const slackTab = page.getByTestId("tab-slack");
    const dashboardTab = page.getByTestId("tab-dashboard");

    await expect(slackTab).toBeVisible();
    await expect(dashboardTab).toBeVisible();
    await expect(slackTab).toContainText("Slack");
    await expect(dashboardTab).toContainText("Dashboard");
  });

  test("slack tab is active by default and shows workspace", async ({ page }) => {
    await page.goto("/");

    // Slack tab should be active (has the active background class)
    const slackTab = page.getByTestId("tab-slack");
    await expect(slackTab).toHaveClass(/bg-slack-aubergine-light/);

    // WorkspaceShell content should be visible (channel sidebar with "general")
    const sidebar = page.locator("aside").nth(1);
    await expect(sidebar.getByText("general")).toBeVisible();
  });

  test("switching to dashboard tab shows dashboard shell", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("tab-dashboard").click();

    // Dashboard shell should be visible
    await expect(page.getByTestId("dashboard-shell")).toBeVisible();
    await expect(page.getByTestId("dashboard-sidebar")).toBeVisible();

    // Default page is Experiments
    await expect(page.getByTestId("page-experiments")).toBeVisible();
    await expect(page.getByText("Experiments coming soon")).toBeVisible();
  });

  test("navigating dashboard pages works", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("tab-dashboard").click();

    // Click Evals
    await page.getByTestId("dashboard-nav-evals").click();
    await expect(page.getByTestId("page-evals")).toBeVisible();
    await expect(page.getByText("Evals coming soon")).toBeVisible();

    // Click Config
    await page.getByTestId("dashboard-nav-config").click();
    await expect(page.getByTestId("page-config")).toBeVisible();
    await expect(page.getByText("Config coming soon")).toBeVisible();

    // Click Monitoring
    await page.getByTestId("dashboard-nav-monitoring").click();
    await expect(page.getByTestId("page-monitoring")).toBeVisible();
    await expect(page.getByText("Monitoring coming soon")).toBeVisible();
  });

  test("switching back to slack preserves slack state", async ({ page }) => {
    await page.goto("/");

    // Wait for initial load — general channel header should be visible
    const channelHeader = page.locator(".font-bold.text-gray-900").first();
    await expect(channelHeader).toBeVisible();

    // Navigate to #sales channel
    const channelSidebar = page.locator("aside").nth(1);
    await channelSidebar.getByText("sales").click();

    // Wait for #sales header to appear in the chat panel header
    await expect(channelHeader).toHaveText("sales");

    // Switch to Dashboard
    await page.getByTestId("tab-dashboard").click();
    await expect(page.getByTestId("dashboard-shell")).toBeVisible();

    // Switch back to Slack
    await page.getByTestId("tab-slack").click();

    // Should still be on #sales — the channel header should say "sales"
    await expect(channelHeader).toHaveText("sales");
  });
});
