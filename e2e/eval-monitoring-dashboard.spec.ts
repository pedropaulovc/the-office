import { test, expect } from "@playwright/test";

test.describe("eval monitoring dashboard", () => {
  test("evals page shows agent cards", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("tab-dashboard").click();
    await page.getByTestId("dashboard-nav-evals").click();

    await expect(page.getByTestId("page-evals")).toBeVisible();
    await expect(page.getByTestId("agent-card").first()).toBeVisible();

    // Verify Michael Scott's card is present somewhere in the grid
    await expect(page.locator("text=Michael Scott").first()).toBeVisible();
  });

  test("config page loads agent configuration", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("tab-dashboard").click();
    await page.getByTestId("dashboard-nav-config").click();

    await expect(page.getByTestId("page-config")).toBeVisible();
    await expect(page.getByTestId("agent-selector")).toBeVisible();

    // Select Michael Scott from the dropdown
    await page.getByTestId("agent-selector").selectOption({ label: "Michael Scott" });

    // Config sections should appear
    await expect(page.getByTestId("config-section-gates")).toBeVisible();
    await expect(page.getByTestId("save-config-btn")).toBeVisible();
  });

  test("monitoring page shows cost and logs sections", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("tab-dashboard").click();
    await page.getByTestId("dashboard-nav-monitoring").click();

    await expect(page.getByTestId("page-monitoring")).toBeVisible();

    // The costs API always returns a summary object so hasData is true
    await expect(page.getByTestId("cost-summary")).toBeVisible();
    await expect(page.getByTestId("correction-logs")).toBeVisible();
    await expect(page.getByTestId("intervention-logs")).toBeVisible();
  });

  test("all dashboard pages are navigable with unique content", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("tab-dashboard").click();

    // Experiments (default)
    await expect(page.getByTestId("page-experiments")).toBeVisible();

    // Evals
    await page.getByTestId("dashboard-nav-evals").click();
    await expect(page.getByTestId("page-evals")).toBeVisible();
    await expect(page.getByTestId("page-experiments")).toBeHidden();

    // Config
    await page.getByTestId("dashboard-nav-config").click();
    await expect(page.getByTestId("page-config")).toBeVisible();
    await expect(page.getByTestId("page-evals")).toBeHidden();

    // Monitoring
    await page.getByTestId("dashboard-nav-monitoring").click();
    await expect(page.getByTestId("page-monitoring")).toBeVisible();
    await expect(page.getByTestId("page-config")).toBeHidden();
  });
});
