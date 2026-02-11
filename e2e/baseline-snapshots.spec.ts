import { test, expect } from "@playwright/test";

const SNAPSHOT_DIR = "snapshots/baseline";

test.describe("baseline snapshots", () => {
  test("general channel", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Good morning everyone!")).toBeVisible();
    await expect(page).toHaveScreenshot(`${SNAPSHOT_DIR}/general-channel.png`, {
      fullPage: true,
    });
  });

  test("accounting channel (private)", async ({ page }) => {
    await page.goto("/");

    // Switch to Kevin (member of #accounting)
    await page.getByTitle("Kevin Malone").click();

    // Navigate to #accounting
    await page.getByRole("button", { name: "accounting" }).click();
    await expect(
      page.getByText("Q3 expense reports are due by end of day Friday")
    ).toBeVisible();

    await expect(page).toHaveScreenshot(
      `${SNAPSHOT_DIR}/accounting-channel.png`,
      { fullPage: true }
    );
  });

  test("DM conversation", async ({ page }) => {
    await page.goto("/");

    // Click on Jim Halpert DM (Michael is default user)
    await page
      .getByRole("button", { name: "Jim Halpert" })
      .filter({ hasNotText: /reply|replies/ })
      .first()
      .click();
    await expect(page.getByText("My main man")).toBeVisible();

    await expect(page).toHaveScreenshot(`${SNAPSHOT_DIR}/dm-conversation.png`, {
      fullPage: true,
    });
  });

  test("thread panel", async ({ page }) => {
    await page.goto("/");

    // Open thread on Michael's "big announcement" message (gen-3, has 3 replies)
    await page.getByText("3 replies").first().click();
    await expect(
      page.getByText("Please tell me it's not another movie Monday")
    ).toBeVisible();

    await expect(page).toHaveScreenshot(`${SNAPSHOT_DIR}/thread-panel.png`, {
      fullPage: true,
    });
  });

  test("user switcher", async ({ page }) => {
    await page.goto("/");

    // Switch to Jim
    await page.getByTitle("Jim Halpert").click();

    // Verify we're now Jim by checking the footer shows Jim
    await expect(
      page.locator("aside").filter({ hasText: "Jim Halpert" }).last()
    ).toBeVisible();

    await expect(page).toHaveScreenshot(`${SNAPSHOT_DIR}/user-switcher.png`, {
      fullPage: true,
    });
  });
});
