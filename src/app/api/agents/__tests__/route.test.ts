import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Agent } from "@/db/schema";

const MOCK_AGENT: Agent = {
  id: "michael",
  displayName: "Michael Scott",
  title: "Regional Manager",
  avatarColor: "#4A90D9",
  systemPrompt: "You are Michael Scott.",
  modelId: "claude-sonnet-4-5-20250929",
  maxTurns: 10,
  maxBudgetUsd: 0.1,
  sessionId: null,
  isActive: true,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

const mockListAgents = vi.fn<() => Promise<Agent[]>>();
const mockGetAgent = vi.fn<(id: string) => Promise<Agent | undefined>>();
const mockCreateAgent = vi.fn<() => Promise<Agent>>();
const mockUpdateAgent = vi.fn<() => Promise<Agent | undefined>>();
const mockDeleteAgent = vi.fn<() => Promise<Agent | undefined>>();

vi.mock("@/db/queries", () => ({
  listAgents: (...args: unknown[]) => mockListAgents(...args as []),
  getAgent: (...args: unknown[]) => mockGetAgent(...args as [string]),
  createAgent: (...args: unknown[]) => mockCreateAgent(...args as []),
  updateAgent: (...args: unknown[]) => mockUpdateAgent(...args as []),
  deleteAgent: (...args: unknown[]) => mockDeleteAgent(...args as []),
}));

describe("GET /api/agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with list of agents", async () => {
    mockListAgents.mockResolvedValue([MOCK_AGENT]);

    const { GET } = await import("../route");
    const response = await GET();
    const body = await response.json() as Agent[];

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]?.id).toBe("michael");
  });

  it("returns empty array when no agents", async () => {
    mockListAgents.mockResolvedValue([]);

    const { GET } = await import("../route");
    const response = await GET();
    const body = await response.json() as Agent[];

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });
});

describe("POST /api/agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 with created agent", async () => {
    mockGetAgent.mockResolvedValue(undefined);
    mockCreateAgent.mockResolvedValue(MOCK_AGENT);

    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/agents", {
      method: "POST",
      body: JSON.stringify({
        id: "michael",
        displayName: "Michael Scott",
        title: "Regional Manager",
        avatarColor: "#4A90D9",
        systemPrompt: "You are Michael Scott.",
      }),
    });
    const response = await POST(request);
    const body = await response.json() as Agent;

    expect(response.status).toBe(201);
    expect(body.id).toBe("michael");
  });

  it("returns 409 when agent ID already exists", async () => {
    mockGetAgent.mockResolvedValue(MOCK_AGENT);

    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/agents", {
      method: "POST",
      body: JSON.stringify({
        id: "michael",
        displayName: "Michael Scott",
        title: "Regional Manager",
        avatarColor: "#4A90D9",
        systemPrompt: "You are Michael Scott.",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(409);
  });

  it("returns 400 for invalid body", async () => {
    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/agents", {
      method: "POST",
      body: JSON.stringify({ id: "" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});

describe("GET /api/agents/[agentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with agent", async () => {
    mockGetAgent.mockResolvedValue(MOCK_AGENT);

    const routeModule = await import("@/app/api/agents/[agentId]/route");
    const response = await routeModule.GET(
      new Request("http://localhost/api/agents/michael"),
      { params: Promise.resolve({ agentId: "michael" }) },
    );
    const body = await response.json() as Agent;

    expect(response.status).toBe(200);
    expect(body.id).toBe("michael");
  });

  it("returns 404 when agent not found", async () => {
    mockGetAgent.mockResolvedValue(undefined);

    const routeModule = await import("@/app/api/agents/[agentId]/route");
    const response = await routeModule.GET(
      new Request("http://localhost/api/agents/nobody"),
      { params: Promise.resolve({ agentId: "nobody" }) },
    );

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/agents/[agentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with updated agent", async () => {
    const updated = { ...MOCK_AGENT, title: "World's Best Boss" };
    mockUpdateAgent.mockResolvedValue(updated);

    const routeModule = await import("@/app/api/agents/[agentId]/route");
    const response = await routeModule.PATCH(
      new Request("http://localhost/api/agents/michael", {
        method: "PATCH",
        body: JSON.stringify({ title: "World's Best Boss" }),
      }),
      { params: Promise.resolve({ agentId: "michael" }) },
    );
    const body = await response.json() as Agent;

    expect(response.status).toBe(200);
    expect(body.title).toBe("World's Best Boss");
  });

  it("returns 404 when agent not found", async () => {
    mockUpdateAgent.mockResolvedValue(undefined);

    const routeModule = await import("@/app/api/agents/[agentId]/route");
    const response = await routeModule.PATCH(
      new Request("http://localhost/api/agents/nobody", {
        method: "PATCH",
        body: JSON.stringify({ title: "Nope" }),
      }),
      { params: Promise.resolve({ agentId: "nobody" }) },
    );

    expect(response.status).toBe(404);
  });

  it("returns 400 for invalid body", async () => {
    const routeModule = await import("@/app/api/agents/[agentId]/route");
    const response = await routeModule.PATCH(
      new Request("http://localhost/api/agents/michael", {
        method: "PATCH",
        body: JSON.stringify({ maxTurns: -1 }),
      }),
      { params: Promise.resolve({ agentId: "michael" }) },
    );

    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/agents/[agentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with soft-deleted agent", async () => {
    const deleted = { ...MOCK_AGENT, isActive: false };
    mockDeleteAgent.mockResolvedValue(deleted);

    const routeModule = await import("@/app/api/agents/[agentId]/route");
    const response = await routeModule.DELETE(
      new Request("http://localhost/api/agents/michael", { method: "DELETE" }),
      { params: Promise.resolve({ agentId: "michael" }) },
    );
    const body = await response.json() as Agent;

    expect(response.status).toBe(200);
    expect(body.isActive).toBe(false);
  });

  it("returns 404 when agent not found", async () => {
    mockDeleteAgent.mockResolvedValue(undefined);

    const routeModule = await import("@/app/api/agents/[agentId]/route");
    const response = await routeModule.DELETE(
      new Request("http://localhost/api/agents/nobody", { method: "DELETE" }),
      { params: Promise.resolve({ agentId: "nobody" }) },
    );

    expect(response.status).toBe(404);
  });
});
