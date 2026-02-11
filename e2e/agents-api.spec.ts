import { test, expect } from "@playwright/test";

interface AgentResponse {
  id: string;
  displayName: string;
  title: string;
  avatarColor: string;
  systemPrompt: string;
  modelId: string;
  maxTurns: number;
  maxBudgetUsd: number;
  sessionId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ErrorResponse {
  error: string;
}

test.describe("agents API", () => {
  test("GET /api/agents returns 200 with array of agents", async ({
    request,
  }) => {
    const response = await request.get("/api/agents");

    expect(response.status()).toBe(200);
    const agents = (await response.json()) as AgentResponse[];
    expect(agents.length).toBeGreaterThanOrEqual(16);

    const michael = agents.find((a) => a.id === "michael");
    expect(michael).toBeDefined();
    expect(michael?.displayName).toBe("Michael Scott");
    expect(michael?.title).toBe("Regional Manager");
    expect(michael?.avatarColor).toBe("#4A90D9");
    expect(michael?.systemPrompt).toBeTruthy();
    expect(michael?.modelId).toBe("claude-sonnet-4-5-20250929");
    expect(michael?.isActive).toBe(true);
  });

  test("GET /api/agents/[agentId] returns single agent", async ({
    request,
  }) => {
    const response = await request.get("/api/agents/jim");

    expect(response.status()).toBe(200);
    const agent = (await response.json()) as AgentResponse;
    expect(agent.id).toBe("jim");
    expect(agent.displayName).toBe("Jim Halpert");
  });

  test("GET /api/agents/[agentId] returns 404 for unknown ID", async ({
    request,
  }) => {
    const response = await request.get("/api/agents/nonexistent-agent");

    expect(response.status()).toBe(404);
  });

  test("POST creates agent, PATCH updates, DELETE soft-deletes", async ({
    request,
  }) => {
    const testId = `e2e-test-${Date.now()}`;

    // POST — create
    const createRes = await request.post("/api/agents", {
      data: {
        id: testId,
        displayName: "Test Agent",
        title: "E2E Tester",
        avatarColor: "#FF0000",
        systemPrompt: "You are a test agent.",
      },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as AgentResponse;
    expect(created.id).toBe(testId);
    expect(created.isActive).toBe(true);

    // POST duplicate — 409
    const dupRes = await request.post("/api/agents", {
      data: {
        id: testId,
        displayName: "Duplicate",
        title: "Dup",
        avatarColor: "#000",
        systemPrompt: "dup",
      },
    });
    expect(dupRes.status()).toBe(409);

    // PATCH — update
    const patchRes = await request.patch(`/api/agents/${testId}`, {
      data: { title: "Updated Tester" },
    });
    expect(patchRes.status()).toBe(200);
    const patched = (await patchRes.json()) as AgentResponse;
    expect(patched.title).toBe("Updated Tester");

    // DELETE — soft-delete
    const deleteRes = await request.delete(`/api/agents/${testId}`);
    expect(deleteRes.status()).toBe(200);
    const deleted = (await deleteRes.json()) as AgentResponse;
    expect(deleted.isActive).toBe(false);

    // Verify soft-deleted agent doesn't appear in list
    const listRes = await request.get("/api/agents");
    const agents = (await listRes.json()) as AgentResponse[];
    expect(agents.find((a) => a.id === testId)).toBeUndefined();
  });

  test("POST returns 400 for invalid body", async ({ request }) => {
    const response = await request.post("/api/agents", {
      data: { id: "" },
    });
    expect(response.status()).toBe(400);
    const body = (await response.json()) as ErrorResponse;
    expect(body.error).toBe("Validation failed");
  });
});
