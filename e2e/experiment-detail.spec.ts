import { test, expect, type Page } from "@playwright/test";

test.describe("experiment detail page", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ request }) => {
    // Create and run an experiment. The POST /run is async (202 Accepted).
    // Poll until the experiment completes.
    const createRes = await request.post("/api/experiments", {
      data: { scenarioId: "brainstorming-average", scale: 0.1 },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as { id: string };

    const runRes = await request.post(`/api/experiments/${created.id}/run`, {
      data: {},
    });
    expect(runRes.status()).toBe(202);

    // Poll until experiment completes (max 45s — persistence can be slow on cold Neon branches)
    let completed = false;
    for (let i = 0; i < 45; i++) {
      const statusRes = await request.get(`/api/experiments/${created.id}`);
      const exp = (await statusRes.json()) as { status: string };
      if (exp.status === "completed" || exp.status === "failed") {
        completed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    expect(completed).toBe(true);
  });

  async function navigateToDetail(page: Page) {
    await page.goto("/");
    await page.getByTestId("tab-dashboard").click();
    await expect(page.getByTestId("page-experiments")).toBeVisible();

    // Find any completed experiment row and click it
    const completedRow = page
      .getByTestId("experiment-row")
      .filter({ has: page.getByText("Completed") })
      .first();
    await expect(completedRow).toBeVisible();
    await completedRow.click();
    await expect(page.getByTestId("page-experiment-detail")).toBeVisible();
  }

  test("shows Table 1 results for completed experiment", async ({ page }) => {
    await navigateToDetail(page);

    // Table 1 results section is visible
    await expect(page.getByTestId("table1-results")).toBeVisible();

    // At least one metric row with numeric data
    const rows = page.getByTestId("table1-results").locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Each row has a metric name and numeric values (treatment mean, control mean)
    const firstRowCells = rows.first().locator("td");
    // Column 0: metric name, Column 1: T mean(sd), Column 2: C mean(sd)
    await expect(firstRowCells.nth(0)).not.toBeEmpty();
    await expect(firstRowCells.nth(1)).toContainText(/\d+\.\d+/);
    await expect(firstRowCells.nth(2)).toContainText(/\d+\.\d+/);
  });

  test("shows header info with scenario, agents, and environments", async ({ page }) => {
    await navigateToDetail(page);

    // Scenario name in header
    await expect(page.getByText("brainstorming-average")).toBeVisible();

    // Agent count and environment count
    await expect(page.getByText(/\d+ agents/)).toBeVisible();
    await expect(page.getByText(/\d+ environments/)).toBeVisible();

    // Status badge shows Completed
    await expect(page.getByText("Completed")).toBeVisible();
  });

  test("back button returns to experiments list", async ({ page }) => {
    await navigateToDetail(page);

    // Click back button
    await page.getByTestId("back-to-experiments").click();

    // Should be back on experiments list
    await expect(page.getByTestId("page-experiments")).toBeVisible();
  });
});
