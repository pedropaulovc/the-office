import { test, expect } from "@playwright/test";

test.describe("dashboard shell adversarial tests", () => {
  test("thread panel preserved across tab switches", async ({ page }) => {
    await page.goto("/");

    // Wait for messages to load
    const authorNames = page.locator(".font-bold.text-sm.text-gray-900");
    await expect(authorNames.first()).toBeVisible();

    // Open a thread
    const threadButton = page.getByRole("button", { name: /\d+ repl/i }).first();
    await expect(threadButton).toBeVisible();
    await threadButton.click();

    // Thread panel should be open
    const threadPanel = page.locator(".border-slack-thread-border");
    await expect(threadPanel).toBeVisible();

    // Switch to Dashboard
    await page.getByTestId("tab-dashboard").click();
    await expect(page.getByTestId("dashboard-shell")).toBeVisible();

    // Thread panel should NOT be visible in dashboard view
    await expect(threadPanel).toBeHidden();

    // Switch back to Slack
    await page.getByTestId("tab-slack").click();

    // Thread panel should still be open (state preserved)
    await expect(threadPanel).toBeVisible();
    await expect(threadPanel.getByText(/\d+ repl/)).toBeVisible();
  });

  test("DM navigation preserved across tab switches", async ({ page }) => {
    await page.goto("/");

    const sidebar = page.locator("aside").nth(1);
    await expect(sidebar.getByText("Jim Halpert")).toBeVisible();

    // Navigate to a DM
    await sidebar.getByText("Jim Halpert").click();

    // Wait for DM header to reflect selection
    const channelHeader = page.locator(".font-bold.text-gray-900").first();
    await expect(channelHeader).toHaveText("Jim Halpert");

    // Switch to Dashboard and back
    await page.getByTestId("tab-dashboard").click();
    await expect(page.getByTestId("dashboard-shell")).toBeVisible();

    await page.getByTestId("tab-slack").click();

    // Should still be on Jim Halpert DM
    await expect(channelHeader).toHaveText("Jim Halpert");
  });

  test("rapid tab switching does not corrupt state", async ({ page }) => {
    await page.goto("/");

    // Wait for initial load
    const sidebar = page.locator("aside").nth(1);
    await expect(sidebar.getByText("general")).toBeVisible();

    // Navigate to sales channel first
    await sidebar.getByText("sales").click();
    const channelHeader = page.locator(".font-bold.text-gray-900").first();
    await expect(channelHeader).toHaveText("sales");

    // Rapidly switch tabs 5 times
    for (let i = 0; i < 5; i++) {
      await page.getByTestId("tab-dashboard").click();
      await page.getByTestId("tab-slack").click();
    }

    // State should be stable — still on sales
    await expect(channelHeader).toHaveText("sales");
    await expect(sidebar.getByText("sales")).toBeVisible();
  });

  test("dashboard sidebar highlights active page correctly", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("tab-dashboard").click();

    // Experiments should be active by default — check for active styling class
    const experimentsNav = page.getByTestId("dashboard-nav-experiments");
    await expect(experimentsNav).toHaveClass(/bg-slack-channel-active/);
    await expect(experimentsNav).toHaveClass(/font-semibold/);

    // Other nav items should NOT have active class
    const evalsNav = page.getByTestId("dashboard-nav-evals");
    await expect(evalsNav).not.toHaveClass(/bg-slack-channel-active/);
    await expect(evalsNav).not.toHaveClass(/font-semibold/);

    // Click Evals — it should become active, Experiments should deactivate
    await evalsNav.click();
    await expect(evalsNav).toHaveClass(/bg-slack-channel-active/);
    await expect(evalsNav).toHaveClass(/font-semibold/);
    await expect(experimentsNav).not.toHaveClass(/bg-slack-channel-active/);
    await expect(experimentsNav).not.toHaveClass(/font-semibold/);
  });

  test("dashboard page selection preserved across tab switches", async ({ page }) => {
    await page.goto("/");

    // Go to dashboard and select Config page
    await page.getByTestId("tab-dashboard").click();
    await page.getByTestId("dashboard-nav-config").click();
    await expect(page.getByTestId("page-config")).toBeVisible();

    // Switch to Slack and back
    await page.getByTestId("tab-slack").click();
    await page.getByTestId("tab-dashboard").click();

    // Config page should still be active
    await expect(page.getByTestId("page-config")).toBeVisible();
    await expect(page.getByTestId("dashboard-nav-config")).toHaveClass(/bg-slack-channel-active/);
  });

  test("slack workspace components NOT visible when on dashboard", async ({ page }) => {
    await page.goto("/");

    // Wait for slack to load
    const sidebar = page.locator("aside").nth(1);
    await expect(sidebar.getByText("general")).toBeVisible();

    // Switch to dashboard
    await page.getByTestId("tab-dashboard").click();
    await expect(page.getByTestId("dashboard-shell")).toBeVisible();

    // Workspace sidebar (first aside with Dunder Mifflin logo area) should NOT be visible
    // The ChannelSidebar should NOT be visible
    // The ChatPanel should NOT be visible
    await expect(page.getByText("general").first()).toBeHidden();

    // The compose textarea should NOT be visible
    await expect(page.locator("textarea")).toBeHidden();
  });

  test("dashboard NOT visible when on slack tab", async ({ page }) => {
    await page.goto("/");

    // Dashboard shell should NOT be in the DOM when on Slack tab
    await expect(page.getByTestId("dashboard-shell")).toBeHidden();
    await expect(page.getByTestId("dashboard-sidebar")).toBeHidden();

    // None of the dashboard pages should be visible
    await expect(page.getByTestId("page-experiments")).toBeHidden();
  });

  test("all four dashboard pages render unique content", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("tab-dashboard").click();

    // Experiments (default)
    await expect(page.getByTestId("page-experiments")).toBeVisible();
    await expect(page.getByTestId("new-experiment-btn")).toBeVisible();

    // Evals
    await page.getByTestId("dashboard-nav-evals").click();
    await expect(page.getByTestId("page-evals")).toBeVisible();
    await expect(page.getByText("Evals coming soon")).toBeVisible();
    // Previous page should not be visible
    await expect(page.getByTestId("page-experiments")).toBeHidden();

    // Config
    await page.getByTestId("dashboard-nav-config").click();
    await expect(page.getByTestId("page-config")).toBeVisible();
    await expect(page.getByText("Config coming soon")).toBeVisible();
    await expect(page.getByTestId("page-evals")).toBeHidden();

    // Monitoring
    await page.getByTestId("dashboard-nav-monitoring").click();
    await expect(page.getByTestId("page-monitoring")).toBeVisible();
    await expect(page.getByText("Monitoring coming soon")).toBeVisible();
    await expect(page.getByTestId("page-config")).toBeHidden();
  });

  test("channel + thread + tab switch round-trip preserves everything", async ({ page }) => {
    await page.goto("/");

    // Wait for initial load
    const sidebar = page.locator("aside").nth(1);
    await expect(sidebar.getByText("general")).toBeVisible();

    // 1. Switch to #sales
    await sidebar.getByText("sales").click();
    const channelHeader = page.locator(".font-bold.text-gray-900").first();
    await expect(channelHeader).toHaveText("sales");

    // 2. Go to Dashboard, navigate to Monitoring page
    await page.getByTestId("tab-dashboard").click();
    await page.getByTestId("dashboard-nav-monitoring").click();
    await expect(page.getByTestId("page-monitoring")).toBeVisible();

    // 3. Go back to Slack — should be on #sales
    await page.getByTestId("tab-slack").click();
    await expect(channelHeader).toHaveText("sales");

    // 4. Go back to Dashboard — should be on Monitoring
    await page.getByTestId("tab-dashboard").click();
    await expect(page.getByTestId("page-monitoring")).toBeVisible();
    await expect(page.getByTestId("dashboard-nav-monitoring")).toHaveClass(/bg-slack-channel-active/);
  });

  test("tab bar active state styling toggles correctly", async ({ page }) => {
    await page.goto("/");

    const slackTab = page.getByTestId("tab-slack");
    const dashboardTab = page.getByTestId("tab-dashboard");

    // Slack should be active initially
    await expect(slackTab).toHaveClass(/bg-slack-aubergine-light/);
    await expect(dashboardTab).not.toHaveClass(/bg-slack-aubergine-light/);

    // Switch to dashboard
    await dashboardTab.click();
    await expect(dashboardTab).toHaveClass(/bg-slack-aubergine-light/);
    await expect(slackTab).not.toHaveClass(/bg-slack-aubergine-light/);

    // Switch back
    await slackTab.click();
    await expect(slackTab).toHaveClass(/bg-slack-aubergine-light/);
    await expect(dashboardTab).not.toHaveClass(/bg-slack-aubergine-light/);
  });

  test("clicking already active tab is a no-op", async ({ page }) => {
    await page.goto("/");

    // Wait for slack content
    const sidebar = page.locator("aside").nth(1);
    await expect(sidebar.getByText("general")).toBeVisible();

    // Click Slack tab again (already active)
    await page.getByTestId("tab-slack").click();

    // Everything should still work — channel sidebar intact
    await expect(sidebar.getByText("general")).toBeVisible();
    await expect(sidebar.getByText("sales")).toBeVisible();

    // Switch to dashboard, click dashboard again
    await page.getByTestId("tab-dashboard").click();
    await expect(page.getByTestId("page-experiments")).toBeVisible();

    await page.getByTestId("tab-dashboard").click();
    await expect(page.getByTestId("page-experiments")).toBeVisible();
  });

  test("existing smoke test still passes — app loads with tab bar", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Dunder Mifflin/);

    // Tab bar should be present at the top
    await expect(page.getByTestId("tab-slack")).toBeVisible();
    await expect(page.getByTestId("tab-dashboard")).toBeVisible();

    // Workspace content should be visible below
    const sidebar = page.locator("aside").nth(1);
    await expect(sidebar.getByText("general")).toBeVisible();
  });
});
