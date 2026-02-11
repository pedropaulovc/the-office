import { describe, it, expect, vi, beforeEach } from "vitest";

// Chain-style mock for Drizzle query builder
function mockChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  const handler = () => chain;
  chain.select = handler;
  chain.from = handler;
  chain.where = handler;
  chain.orderBy = handler;
  chain.innerJoin = handler;
  chain.groupBy = handler;
  chain.having = handler;
  chain.insert = handler;
  chain.values = handler;
  chain.onConflictDoUpdate = handler;
  chain.returning = () => Promise.resolve(result);
  chain.then = (resolve: (v: unknown) => void) => {
    resolve(result);
    return Promise.resolve(result);
  };
  return chain;
}

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
};

vi.mock("@/db/client", () => ({
  db: mockDb,
}));

vi.mock("@/db/schema", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/db/schema")>();
  return { ...original };
});

describe("unreads queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAllUnreads returns grouped unread counts", async () => {
    mockDb.select.mockReturnValue(
      mockChain([
        { userId: "michael", channelId: "sales", unreadCount: 3 },
        { userId: "michael", channelId: "random", unreadCount: 2 },
        { userId: "jim", channelId: "general", unreadCount: 4 },
      ]),
    );

    const { getAllUnreads } = await import("../unreads");
    const result = await getAllUnreads();

    expect(result).toEqual({
      michael: { sales: 3, random: 2 },
      jim: { general: 4 },
    });
  });

  it("getAllUnreads returns empty object when no unreads", async () => {
    mockDb.select.mockReturnValue(mockChain([]));

    const { getAllUnreads } = await import("../unreads");
    const result = await getAllUnreads();

    expect(result).toEqual({});
  });

  it("getUnreadsByUser returns unread counts for a user", async () => {
    mockDb.select.mockReturnValue(
      mockChain([
        { channelId: "sales", unreadCount: 3 },
        { channelId: "party-planning", unreadCount: 5 },
      ]),
    );

    const { getUnreadsByUser } = await import("../unreads");
    const result = await getUnreadsByUser("michael");

    expect(result).toEqual({
      sales: 3,
      "party-planning": 5,
    });
  });

  it("getUnreadsByUser returns empty object when no unreads", async () => {
    mockDb.select.mockReturnValue(mockChain([]));

    const { getUnreadsByUser } = await import("../unreads");
    const result = await getUnreadsByUser("oscar");

    expect(result).toEqual({});
  });

  it("markChannelRead calls insert with onConflictDoUpdate", async () => {
    mockDb.insert.mockReturnValue(mockChain(undefined));

    const { markChannelRead } = await import("../unreads");
    await markChannelRead("michael", "general");

    expect(mockDb.insert).toHaveBeenCalled();
  });
});
