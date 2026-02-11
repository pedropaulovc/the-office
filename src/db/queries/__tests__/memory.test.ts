import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MemoryBlock, ArchivalPassage } from "@/db/schema";

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
  content: "That time I grilled my foot on the George Foreman grill.",
  tags: ["incident", "memorable"],
  createdAt: new Date("2025-01-01"),
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
  chain.delete = handler;
  chain.onConflictDoUpdate = handler;
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
  delete: vi.fn(),
};

vi.mock("@/db/client", () => ({
  db: mockDb,
}));

vi.mock("@/db/schema", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/db/schema")>();
  return { ...original };
});

describe("memory queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listMemoryBlocks returns blocks for an agent", async () => {
    mockDb.select.mockReturnValue(mockChain([MOCK_BLOCK]));

    const { listMemoryBlocks } = await import("../memory");
    const result = await listMemoryBlocks("michael");

    expect(result).toEqual([MOCK_BLOCK]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("getMemoryBlock returns a block by agent and label", async () => {
    mockDb.select.mockReturnValue(mockChain([MOCK_BLOCK]));

    const { getMemoryBlock } = await import("../memory");
    const result = await getMemoryBlock("michael", "personality");

    expect(result).toEqual(MOCK_BLOCK);
  });

  it("getMemoryBlock returns undefined for missing block", async () => {
    mockDb.select.mockReturnValue(mockChain([]));

    const { getMemoryBlock } = await import("../memory");
    const result = await getMemoryBlock("michael", "nonexistent");

    expect(result).toBeUndefined();
  });

  it("upsertMemoryBlock inserts/updates and returns the block", async () => {
    mockDb.insert.mockReturnValue(mockChain([MOCK_BLOCK]));

    const { upsertMemoryBlock } = await import("../memory");
    const result = await upsertMemoryBlock({
      agentId: "michael",
      label: "personality",
      content: "I am the world's best boss.",
    });

    expect(result).toEqual(MOCK_BLOCK);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("deleteMemoryBlock deletes and returns the block", async () => {
    mockDb.delete.mockReturnValue(mockChain([MOCK_BLOCK]));

    const { deleteMemoryBlock } = await import("../memory");
    const result = await deleteMemoryBlock("michael", "personality");

    expect(result).toEqual(MOCK_BLOCK);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("deleteMemoryBlock returns undefined when not found", async () => {
    mockDb.delete.mockReturnValue(mockChain([]));

    const { deleteMemoryBlock } = await import("../memory");
    const result = await deleteMemoryBlock("michael", "nonexistent");

    expect(result).toBeUndefined();
  });
});

describe("archival queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listArchivalPassages returns passages for an agent", async () => {
    mockDb.select.mockReturnValue(mockChain([MOCK_PASSAGE]));

    const { listArchivalPassages } = await import("../memory");
    const result = await listArchivalPassages("michael");

    expect(result).toEqual([MOCK_PASSAGE]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("listArchivalPassages accepts a search query", async () => {
    mockDb.select.mockReturnValue(mockChain([MOCK_PASSAGE]));

    const { listArchivalPassages } = await import("../memory");
    const result = await listArchivalPassages("michael", "grill");

    expect(result).toEqual([MOCK_PASSAGE]);
  });

  it("createArchivalPassage inserts and returns the passage", async () => {
    mockDb.insert.mockReturnValue(mockChain([MOCK_PASSAGE]));

    const { createArchivalPassage } = await import("../memory");
    const result = await createArchivalPassage({
      agentId: "michael",
      content: "That time I grilled my foot on the George Foreman grill.",
      tags: ["incident", "memorable"],
    });

    expect(result).toEqual(MOCK_PASSAGE);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("deleteArchivalPassage deletes and returns the passage", async () => {
    mockDb.delete.mockReturnValue(mockChain([MOCK_PASSAGE]));

    const { deleteArchivalPassage } = await import("../memory");
    const result = await deleteArchivalPassage("passage-uuid-1");

    expect(result).toEqual(MOCK_PASSAGE);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("deleteArchivalPassage returns undefined when not found", async () => {
    mockDb.delete.mockReturnValue(mockChain([]));

    const { deleteArchivalPassage } = await import("../memory");
    const result = await deleteArchivalPassage("nonexistent");

    expect(result).toBeUndefined();
  });
});
