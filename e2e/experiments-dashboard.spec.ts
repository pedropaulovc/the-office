import { test, expect } from "@playwright/test";

test.describe("experiments dashboard", () => {
  test("navigates to experiments page in dashboard", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("tab-dashboard").click();
    await expect(page.getByTestId("page-experiments")).toBeVisible();
    await expect(page.getByTestId("new-experiment-btn")).toBeVisible();
  });

  test("opens and closes launch dialog", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("tab-dashboard").click();
    await page.getByTestId("new-experiment-btn").click();
    await expect(page.getByTestId("launch-dialog")).toBeVisible();
    await page.getByTestId("cancel-btn").click();
    await expect(page.getByTestId("launch-dialog")).toBeHidden();
  });

  test("launches experiment and sees it in list", async ({ page, request }) => {
    // Create an experiment via API
    const createRes = await request.post("/api/experiments", {
      data: { scenarioId: "brainstorming-average", scale: 0.1 },
    });
    expect(createRes.status()).toBe(201);

    // Navigate to dashboard
    await page.goto("/");
    await page.getByTestId("tab-dashboard").click();

    // Should see at least one experiment row with a status badge
    await expect(page.getByTestId("experiment-row").first()).toBeVisible();
    await expect(page.getByTestId("experiment-status").first()).toContainText(
      /pending|running|completed|failed/i,
    );
  });

  test("displays completed experiment with correct status", async ({ page, request }) => {
    // Create and run an experiment via API
    const createRes = await request.post("/api/experiments", {
      data: { scenarioId: "brainstorming-average", scale: 0.1 },
    });
    const created = (await createRes.json()) as { id: string };
    await request.post(`/api/experiments/${created.id}/run`, { data: {} });

    // Navigate to dashboard
    await page.goto("/");
    await page.getByTestId("tab-dashboard").click();

    // Should see a completed experiment
    await expect(page.getByText(/completed/i).first()).toBeVisible();
  });
});
