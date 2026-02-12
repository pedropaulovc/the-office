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

// Chain-style mock for Drizzle query builder
function mockChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  const handler = () => chain;
  chain.select = handler;
  chain.from = handler;
  chain.where = handler;
  chain.orderBy = handler;
  chain.insert = handler;
  chain.values = handler;
  chain.returning = () => Promise.resolve(result);
  chain.set = handler;
  chain.update = handler;
  chain.onConflictDoNothing = handler;
  chain.then = (resolve: (v: unknown) => void) => {
    resolve(result);
    return Promise.resolve(result);
  };
  return chain;
}

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
};

vi.mock("@/db/client", () => ({
  db: mockDb,
}));

vi.mock("@/db/schema", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/db/schema")>();
  return { ...original };
});

describe("agents queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listAgents returns active agents ordered by createdAt", async () => {
    const agents = [MOCK_AGENT];
    mockDb.select.mockReturnValue(mockChain(agents));

    const { listAgents } = await import("../agents");
    const result = await listAgents();

    expect(result).toEqual(agents);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("getAgent returns agent by id", async () => {
    mockDb.select.mockReturnValue(mockChain([MOCK_AGENT]));

    const { getAgent } = await import("../agents");
    const result = await getAgent("michael");

    expect(result).toEqual(MOCK_AGENT);
  });

  it("getAgent returns undefined for missing id", async () => {
    mockDb.select.mockReturnValue(mockChain([]));

    const { getAgent } = await import("../agents");
    const result = await getAgent("nonexistent");

    expect(result).toBeUndefined();
  });

  it("createAgent inserts and returns the agent", async () => {
    mockDb.insert.mockReturnValue(mockChain([MOCK_AGENT]));

    const { createAgent } = await import("../agents");
    const result = await createAgent({
      id: "michael",
      displayName: "Michael Scott",
      title: "Regional Manager",
      avatarColor: "#4A90D9",
      systemPrompt: "You are Michael Scott.",
    });

    expect(result).toEqual(MOCK_AGENT);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("updateAgent updates and returns the agent", async () => {
    const updated = { ...MOCK_AGENT, title: "World's Best Boss" };
    mockDb.update.mockReturnValue(mockChain([updated]));

    const { updateAgent } = await import("../agents");
    const result = await updateAgent("michael", { title: "World's Best Boss" });

    expect(result?.title).toBe("World's Best Boss");
  });

  it("updateAgent returns undefined when agent not found", async () => {
    mockDb.update.mockReturnValue(mockChain([]));

    const { updateAgent } = await import("../agents");
    const result = await updateAgent("nonexistent", { title: "Nothing" });

    expect(result).toBeUndefined();
  });

  it("deleteAgent soft-deletes by setting isActive to false", async () => {
    const deleted = { ...MOCK_AGENT, isActive: false };
    mockDb.update.mockReturnValue(mockChain([deleted]));

    const { deleteAgent } = await import("../agents");
    const result = await deleteAgent("michael");

    expect(result?.isActive).toBe(false);
  });
});
