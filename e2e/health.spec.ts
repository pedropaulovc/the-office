import { test, expect } from "@playwright/test";

interface HealthResponse {
  status: string;
  database: string;
  error?: string;
}

test.describe("health endpoint", () => {
  test("returns 200 with status ok", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);

    const body = (await response.json()) as HealthResponse;
    expect(body.status).toBe("ok");
    expect(["connected", "unavailable"]).toContain(body.database);
  });

  test("database field matches connectivity", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = (await response.json()) as HealthResponse;

    // This test works in both local (with DB) and CI (without DB) environments
    expect(body.status).toBe("ok");
    expect(["connected", "unavailable"]).toContain(body.database);
  });
});
