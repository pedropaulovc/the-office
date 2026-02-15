import { test, expect, type Page } from "@playwright/test";

test.describe("experiment drill-down to Slack", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ request }) => {
    // Wait for any completed experiment (may be created by experiment-detail tests running in parallel).
    // Only create our own experiment as a fallback if none exist after initial check.
    let hasCompleted = false;

    for (let i = 0; i < 45; i++) {
      const listRes = await request.get("/api/experiments");
      const experiments = (await listRes.json()) as { id: string; status: string }[];
      if (experiments.some((e) => e.status === "completed")) {
        hasCompleted = true;
        break;
      }

      // On the first iteration, create an experiment if nothing is in-flight
      if (i === 0 && !experiments.some((e) => e.status === "running")) {
        const createRes = await request.post("/api/experiments", {
          data: { scenarioId: "brainstorming-average", scale: 0.1 },
        });
        if (createRes.status() === 201) {
          const created = (await createRes.json()) as { id: string };
          await request.post(`/api/experiments/${created.id}/run`, { data: {} });
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    expect(hasCompleted).toBe(true);
  });

  async function navigateToDetail(page: Page) {
    await page.goto("/");
    await page.getByTestId("tab-dashboard").click();
    await expect(page.getByTestId("page-experiments")).toBeVisible();

    const completedRow = page
      .getByTestId("experiment-row")
      .filter({ has: page.getByText("Completed") })
      .first();
    await expect(completedRow).toBeVisible();
    await completedRow.click();
    await expect(page.getByTestId("page-experiment-detail")).toBeVisible();
  }

  async function drillDownToSlack(page: Page) {
    await navigateToDetail(page);
    await expect(page.getByTestId("environments-list")).toBeVisible();

    const viewBtn = page.getByTestId("view-in-slack").first();
    await expect(viewBtn).toBeEnabled();
    await viewBtn.click();
  }

  test("clicking View navigates to Slack with experiment channel messages", async ({
    page,
  }) => {
    await drillDownToSlack(page);

    // Tab should switch to Slack (active styling)
    await expect(page.getByTestId("tab-slack")).toHaveClass(
      /bg-slack-aubergine-light/,
    );

    // Channel header shows the experiment channel name (contains "exp-")
    const channelHeader = page.locator(".font-bold.text-gray-900").first();
    await expect(channelHeader).toContainText(/exp-/);

    // Messages should be visible (at least one message author name)
    const authorNames = page.locator(".font-bold.text-sm.text-gray-900");
    await expect(authorNames.first()).toBeVisible();
  });

  test("can navigate back to dashboard after drill-down", async ({ page }) => {
    await drillDownToSlack(page);

    // Verify we are on Slack
    await expect(page.getByTestId("tab-slack")).toHaveClass(
      /bg-slack-aubergine-light/,
    );

    // Click back to dashboard
    await page.getByTestId("tab-dashboard").click();

    // Should be back on the experiment detail page (dashboard preserves page state)
    await expect(page.getByTestId("page-experiment-detail")).toBeVisible();
    await expect(page.getByTestId("environments-list")).toBeVisible();
  });

  test("multiple View buttons exist for environments", async ({ page }) => {
    await navigateToDetail(page);
    await expect(page.getByTestId("environments-list")).toBeVisible();

    // brainstorming-average at scale 0.1 creates multiple environments
    // Each row should have a View button
    const viewButtons = page.getByTestId("view-in-slack");
    const count = await viewButtons.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
