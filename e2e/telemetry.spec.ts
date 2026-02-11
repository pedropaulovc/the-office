import { test, expect } from "@playwright/test";

test.describe("telemetry test endpoint", () => {
  test("GET /api/telemetry-test returns ok with telemetry data", async ({
    request,
  }) => {
    const response = await request.get("/api/telemetry-test");

    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      message: string;
      timestamp: string;
    };
    expect(body.ok).toBe(true);
    expect(body.message).toContain("Telemetry test");
    expect(body.timestamp).toBeTruthy();
  });
});
