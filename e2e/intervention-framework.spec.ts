import { test, expect } from "@playwright/test";

interface InterventionLogEntry {
  id: string;
  agentId: string;
  channelId: string | null;
  interventionType: string;
  textualPrecondition: string | null;
  textualPreconditionResult: boolean | null;
  functionalPreconditionResult: boolean | null;
  propositionalPreconditionResult: boolean | null;
  fired: boolean;
  nudgeText: string | null;
  tokenUsage: unknown;
  createdAt: string;
}

test.describe("Intervention Framework (S-7.1a)", () => {
  const API = "/api/evaluations/interventions";

  test("GET returns empty list initially", async ({ request }) => {
    const res = await request.get(API);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { logs: InterventionLogEntry[] };
    expect(body.logs).toBeDefined();
    expect(Array.isArray(body.logs)).toBe(true);
  });

  test("POST creates intervention log entry", async ({ request }) => {
    const res = await request.post(API, {
      data: {
        agentId: "michael",
        channelId: "general",
        interventionType: "custom",
        fired: true,
        nudgeText: "Try a different approach",
      },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { log: InterventionLogEntry };
    expect(body.log.agentId).toBe("michael");
    expect(body.log.channelId).toBe("general");
    expect(body.log.interventionType).toBe("custom");
    expect(body.log.fired).toBe(true);
    expect(body.log.nudgeText).toBe("Try a different approach");
    expect(body.log.id).toBeTruthy();
  });

  test("GET filters by agentId", async ({ request }) => {
    // Create a log entry first
    await request.post(API, {
      data: {
        agentId: "dwight",
        interventionType: "anti_convergence",
        fired: false,
      },
    });

    const res = await request.get(`${API}?agentId=dwight`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { logs: InterventionLogEntry[] };
    expect(body.logs.length).toBeGreaterThanOrEqual(1);
    expect(
      body.logs.every((l) => l.agentId === "dwight"),
    ).toBe(true);
  });

  test("GET filters by fired status", async ({ request }) => {
    // Seed a fired=true entry
    await request.post(API, {
      data: {
        agentId: "jim",
        interventionType: "variety",
        fired: true,
        nudgeText: "Be more creative",
      },
    });

    const res = await request.get(`${API}?fired=true`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { logs: InterventionLogEntry[] };
    for (const log of body.logs) {
      expect(log.fired).toBe(true);
    }
  });

  test("POST validates required fields", async ({ request }) => {
    const res = await request.post(API, {
      data: { fired: true }, // missing agentId and interventionType
    });
    expect(res.status()).toBe(400);
  });

  test("POST validates interventionType enum", async ({ request }) => {
    const res = await request.post(API, {
      data: {
        agentId: "michael",
        interventionType: "invalid_type",
        fired: true,
      },
    });
    expect(res.status()).toBe(400);
  });

  test("GET respects limit parameter", async ({ request }) => {
    const res = await request.get(`${API}?limit=1`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { logs: InterventionLogEntry[] };
    expect(body.logs.length).toBeLessThanOrEqual(1);
  });
});
