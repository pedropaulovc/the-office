import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Agent, MemoryBlock, ArchivalPassage } from "@/db/schema";

const MOCK_AGENT: Agent = {
  id: "michael",
  displayName: "Michael Scott",
  title: "Regional Manager",
  avatarColor: "#4A90D9",
  systemPrompt: "You are Michael Scott.",
  modelId: "claude-sonnet-4-5-20250929",
  maxTurns: 5,
  maxBudgetUsd: 0.1,
  sessionId: null,
  isActive: true,
  experimentId: null,
  persona: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

const MOCK_BLOCK: MemoryBlock = {
  id: "block-uuid-1",
  agentId: "michael",
  label: "personality",
  content: "I am the world's best boss.",
  isShared: false,
  updatedAt: new Date("2025-01-01"),
};

const MOCK_PASSAGE: ArchivalPassage = {
  id: "passage-uuid-1",
  agentId: "michael",
  content: "That time I grilled my foot.",
  tags: ["incident"],
  createdAt: new Date("2025-01-01"),
};

const mockGetAgent = vi.fn<(id: string) => Promise<Agent | undefined>>();
const mockListMemoryBlocks = vi.fn<(agentId: string) => Promise<MemoryBlock[]>>();
const mockUpsertMemoryBlock = vi.fn<() => Promise<MemoryBlock>>();
const mockDeleteMemoryBlock = vi.fn<() => Promise<MemoryBlock | undefined>>();
const mockListArchivalPassages = vi.fn<() => Promise<ArchivalPassage[]>>();
const mockCreateArchivalPassage = vi.fn<() => Promise<ArchivalPassage>>();
const mockDeleteArchivalPassage = vi.fn<() => Promise<ArchivalPassage | undefined>>();

vi.mock("@/db/queries", () => ({
  getAgent: (...args: unknown[]) => mockGetAgent(...args as [string]),
  listMemoryBlocks: (...args: unknown[]) => mockListMemoryBlocks(...args as [string]),
  upsertMemoryBlock: (...args: unknown[]) => mockUpsertMemoryBlock(...args as []),
  deleteMemoryBlock: (...args: unknown[]) => mockDeleteMemoryBlock(...args as []),
  listArchivalPassages: (...args: unknown[]) => mockListArchivalPassages(...args as []),
  createArchivalPassage: (...args: unknown[]) => mockCreateArchivalPassage(...args as []),
  deleteArchivalPassage: (...args: unknown[]) => mockDeleteArchivalPassage(...args as []),
}));

const agentParams = { params: Promise.resolve({ agentId: "michael" }) };

describe("GET /api/agents/[agentId]/memory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with list of memory blocks", async () => {
    mockGetAgent.mockResolvedValue(MOCK_AGENT);
    mockListMemoryBlocks.mockResolvedValue([MOCK_BLOCK]);

    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/agents/michael/memory"),
      agentParams,
    );
    const body = await response.json() as MemoryBlock[];

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]?.label).toBe("personality");
  });

  it("returns 404 when agent not found", async () => {
    mockGetAgent.mockResolvedValue(undefined);

    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/agents/nobody/memory"),
      { params: Promise.resolve({ agentId: "nobody" }) },
    );

    expect(response.status).toBe(404);
  });
});

describe("PUT /api/agents/[agentId]/memory/[label]", () => {
  beforeEach(() => vi.clearAllMocks());

  const labelParams = { params: Promise.resolve({ agentId: "michael", label: "personality" }) };

  it("returns 200 with upserted block", async () => {
    mockGetAgent.mockResolvedValue(MOCK_AGENT);
    mockUpsertMemoryBlock.mockResolvedValue(MOCK_BLOCK);

    const routeModule = await import("../../memory/[label]/route");
    const response = await routeModule.PUT(
      new Request("http://localhost/api/agents/michael/memory/personality", {
        method: "PUT",
        body: JSON.stringify({ content: "I am the world's best boss." }),
      }),
      labelParams,
    );
    const body = await response.json() as MemoryBlock;

    expect(response.status).toBe(200);
    expect(body.label).toBe("personality");
  });

  it("returns 404 when agent not found", async () => {
    mockGetAgent.mockResolvedValue(undefined);

    const routeModule = await import("../../memory/[label]/route");
    const response = await routeModule.PUT(
      new Request("http://localhost/api/agents/nobody/memory/personality", {
        method: "PUT",
        body: JSON.stringify({ content: "test" }),
      }),
      { params: Promise.resolve({ agentId: "nobody", label: "personality" }) },
    );

    expect(response.status).toBe(404);
  });

  it("returns 400 for invalid body", async () => {
    mockGetAgent.mockResolvedValue(MOCK_AGENT);

    const routeModule = await import("../../memory/[label]/route");
    const response = await routeModule.PUT(
      new Request("http://localhost/api/agents/michael/memory/personality", {
        method: "PUT",
        body: JSON.stringify({ content: "" }),
      }),
      labelParams,
    );

    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/agents/[agentId]/memory/[label]", () => {
  beforeEach(() => vi.clearAllMocks());

  const labelParams = { params: Promise.resolve({ agentId: "michael", label: "personality" }) };

  it("returns 200 with deleted block", async () => {
    mockGetAgent.mockResolvedValue(MOCK_AGENT);
    mockDeleteMemoryBlock.mockResolvedValue(MOCK_BLOCK);

    const routeModule = await import("../../memory/[label]/route");
    const response = await routeModule.DELETE(
      new Request("http://localhost/api/agents/michael/memory/personality", { method: "DELETE" }),
      labelParams,
    );
    const body = await response.json() as MemoryBlock;

    expect(response.status).toBe(200);
    expect(body.label).toBe("personality");
  });

  it("returns 404 when agent not found", async () => {
    mockGetAgent.mockResolvedValue(undefined);

    const routeModule = await import("../../memory/[label]/route");
    const response = await routeModule.DELETE(
      new Request("http://localhost/api/agents/nobody/memory/personality", { method: "DELETE" }),
      { params: Promise.resolve({ agentId: "nobody", label: "personality" }) },
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when block not found", async () => {
    mockGetAgent.mockResolvedValue(MOCK_AGENT);
    mockDeleteMemoryBlock.mockResolvedValue(undefined);

    const routeModule = await import("../../memory/[label]/route");
    const response = await routeModule.DELETE(
      new Request("http://localhost/api/agents/michael/memory/nonexistent", { method: "DELETE" }),
      { params: Promise.resolve({ agentId: "michael", label: "nonexistent" }) },
    );

    expect(response.status).toBe(404);
  });
});

describe("GET /api/agents/[agentId]/archival", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with list of passages", async () => {
    mockGetAgent.mockResolvedValue(MOCK_AGENT);
    mockListArchivalPassages.mockResolvedValue([MOCK_PASSAGE]);

    const routeModule = await import("../../archival/route");
    const response = await routeModule.GET(
      new Request("http://localhost/api/agents/michael/archival"),
      agentParams,
    );
    const body = await response.json() as ArchivalPassage[];

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
  });

  it("passes query param for keyword search", async () => {
    mockGetAgent.mockResolvedValue(MOCK_AGENT);
    mockListArchivalPassages.mockResolvedValue([MOCK_PASSAGE]);

    const routeModule = await import("../../archival/route");
    await routeModule.GET(
      new Request("http://localhost/api/agents/michael/archival?q=grill"),
      agentParams,
    );

    expect(mockListArchivalPassages).toHaveBeenCalledWith("michael", "grill");
  });

  it("returns 404 when agent not found", async () => {
    mockGetAgent.mockResolvedValue(undefined);

    const routeModule = await import("../../archival/route");
    const response = await routeModule.GET(
      new Request("http://localhost/api/agents/nobody/archival"),
      { params: Promise.resolve({ agentId: "nobody" }) },
    );

    expect(response.status).toBe(404);
  });
});

describe("POST /api/agents/[agentId]/archival", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 201 with created passage", async () => {
    mockGetAgent.mockResolvedValue(MOCK_AGENT);
    mockCreateArchivalPassage.mockResolvedValue(MOCK_PASSAGE);

    const routeModule = await import("../../archival/route");
    const response = await routeModule.POST(
      new Request("http://localhost/api/agents/michael/archival", {
        method: "POST",
        body: JSON.stringify({ content: "That time I grilled my foot.", tags: ["incident"] }),
      }),
      agentParams,
    );
    const body = await response.json() as ArchivalPassage;

    expect(response.status).toBe(201);
    expect(body.content).toBe("That time I grilled my foot.");
  });

  it("returns 400 for invalid body", async () => {
    mockGetAgent.mockResolvedValue(MOCK_AGENT);

    const routeModule = await import("../../archival/route");
    const response = await routeModule.POST(
      new Request("http://localhost/api/agents/michael/archival", {
        method: "POST",
        body: JSON.stringify({ content: "" }),
      }),
      agentParams,
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when agent not found", async () => {
    mockGetAgent.mockResolvedValue(undefined);

    const routeModule = await import("../../archival/route");
    const response = await routeModule.POST(
      new Request("http://localhost/api/agents/nobody/archival", {
        method: "POST",
        body: JSON.stringify({ content: "test" }),
      }),
      { params: Promise.resolve({ agentId: "nobody" }) },
    );

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/agents/[agentId]/archival/[passageId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with deleted passage", async () => {
    mockDeleteArchivalPassage.mockResolvedValue(MOCK_PASSAGE);

    const routeModule = await import("../../archival/[passageId]/route");
    const response = await routeModule.DELETE(
      new Request("http://localhost/api/agents/michael/archival/passage-uuid-1", { method: "DELETE" }),
      { params: Promise.resolve({ agentId: "michael", passageId: "passage-uuid-1" }) },
    );
    const body = await response.json() as ArchivalPassage;

    expect(response.status).toBe(200);
    expect(body.id).toBe("passage-uuid-1");
  });

  it("returns 404 when passage not found", async () => {
    mockDeleteArchivalPassage.mockResolvedValue(undefined);

    const routeModule = await import("../../archival/[passageId]/route");
    const response = await routeModule.DELETE(
      new Request("http://localhost/api/agents/michael/archival/nonexistent", { method: "DELETE" }),
      { params: Promise.resolve({ agentId: "michael", passageId: "nonexistent" }) },
    );

    expect(response.status).toBe(404);
  });
});
