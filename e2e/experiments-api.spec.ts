import { test, expect } from "@playwright/test";

interface ExperimentBody {
  id: string;
  scenarioId: string;
  seed: number;
  scale: number;
  mode: string;
  status: string;
  populationSource: string;
  sourceAgentIds: string[] | null;
  config: unknown;
  report: unknown;
  agentCount: number;
  environmentCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface ExperimentEnvironmentBody {
  id: string;
  experimentId: string;
  environmentIndex: number;
  group: string;
  channelId: string | null;
  agentIds: string[];
  trajectory: unknown;
}

interface ErrorBody {
  error: string;
}

test.describe("experiments API", () => {
  test("POST /api/experiments creates experiment with defaults", async ({ request }) => {
    const response = await request.post("/api/experiments", {
      data: { scenarioId: "brainstorming-average" },
    });
    expect(response.status()).toBe(201);

    const body = (await response.json()) as ExperimentBody;
    expect(body.id).toBeDefined();
    expect(body.scenarioId).toBe("brainstorming-average");
    expect(body.status).toBe("pending");
    expect(body.seed).toBe(42);
    expect(body.scale).toBeCloseTo(0.1);
    expect(body.mode).toBe("template");
    expect(body.populationSource).toBe("generated");
  });

  test("POST /api/experiments creates experiment with custom params", async ({ request }) => {
    const response = await request.post("/api/experiments", {
      data: {
        scenarioId: "debate-controversial",
        seed: 99,
        scale: 0.5,
        mode: "llm",
        populationSource: "existing",
        sourceAgentIds: ["michael", "dwight"],
      },
    });
    expect(response.status()).toBe(201);

    const body = (await response.json()) as ExperimentBody;
    expect(body.scenarioId).toBe("debate-controversial");
    expect(body.seed).toBe(99);
    expect(body.scale).toBeCloseTo(0.5);
    expect(body.mode).toBe("llm");
    expect(body.populationSource).toBe("existing");
    expect(body.sourceAgentIds).toEqual(["michael", "dwight"]);
  });

  test("POST /api/experiments validates required fields", async ({ request }) => {
    const response = await request.post("/api/experiments", {
      data: {},
    });
    expect(response.status()).toBe(400);
    const body = (await response.json()) as ErrorBody;
    expect(body.error).toBeDefined();
  });

  test("GET /api/experiments lists experiments", async ({ request }) => {
    // Create one first
    await request.post("/api/experiments", {
      data: { scenarioId: "brainstorming-average" },
    });

    const response = await request.get("/api/experiments");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as ExperimentBody[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]?.id).toBeDefined();
  });

  test("GET /api/experiments/[id] returns experiment detail", async ({ request }) => {
    const createRes = await request.post("/api/experiments", {
      data: { scenarioId: "debate-controversial", seed: 77 },
    });
    const created = (await createRes.json()) as ExperimentBody;

    const response = await request.get(`/api/experiments/${created.id}`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as ExperimentBody;
    expect(body.id).toBe(created.id);
    expect(body.scenarioId).toBe("debate-controversial");
    expect(body.seed).toBe(77);
  });

  test("GET /api/experiments/[id] returns 404 for missing", async ({ request }) => {
    const response = await request.get(
      "/api/experiments/00000000-0000-0000-0000-000000000000",
    );
    expect(response.status()).toBe(404);
  });

  test("DELETE /api/experiments/[id] removes experiment", async ({ request }) => {
    const createRes = await request.post("/api/experiments", {
      data: { scenarioId: "brainstorming-average" },
    });
    const created = (await createRes.json()) as ExperimentBody;

    const deleteRes = await request.delete(`/api/experiments/${created.id}`);
    expect(deleteRes.status()).toBe(204);

    // Verify it's gone
    const getRes = await request.get(`/api/experiments/${created.id}`);
    expect(getRes.status()).toBe(404);
  });

  test("DELETE /api/experiments/[id] returns 404 for missing", async ({ request }) => {
    const response = await request.delete(
      "/api/experiments/00000000-0000-0000-0000-000000000000",
    );
    expect(response.status()).toBe(404);
  });

  test("GET /api/experiments/[id]/environments returns empty for new experiment", async ({ request }) => {
    const createRes = await request.post("/api/experiments", {
      data: { scenarioId: "brainstorming-average" },
    });
    const created = (await createRes.json()) as ExperimentBody;

    const response = await request.get(
      `/api/experiments/${created.id}/environments`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as ExperimentEnvironmentBody[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });
});
