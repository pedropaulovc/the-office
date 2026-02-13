import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockScheduledMessage } from "@/tests/factories";

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

const MOCK_MSG = createMockScheduledMessage();

describe("scheduler queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getDueMessages returns pending messages where triggerAt <= now", async () => {
    const dueMsg = createMockScheduledMessage({
      triggerAt: new Date("2020-01-01"),
    });
    mockDb.select.mockReturnValue(mockChain([dueMsg]));

    const { getDueMessages } = await import("../scheduler");
    const result = await getDueMessages();

    expect(result).toEqual([dueMsg]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("getDueMessages returns empty array when no due messages", async () => {
    mockDb.select.mockReturnValue(mockChain([]));

    const { getDueMessages } = await import("../scheduler");
    const result = await getDueMessages();

    expect(result).toEqual([]);
  });

  it("markFired updates status to fired", async () => {
    const fired = createMockScheduledMessage({ status: "fired" });
    mockDb.update.mockReturnValue(mockChain([fired]));

    const { markFired } = await import("../scheduler");
    const result = await markFired("sched-1");

    expect(result?.status).toBe("fired");
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("markFired returns undefined for missing id", async () => {
    mockDb.update.mockReturnValue(mockChain([]));

    const { markFired } = await import("../scheduler");
    const result = await markFired("nonexistent");

    expect(result).toBeUndefined();
  });

  it("createScheduledMessage inserts and returns", async () => {
    mockDb.insert.mockReturnValue(mockChain([MOCK_MSG]));

    const { createScheduledMessage } = await import("../scheduler");
    const result = await createScheduledMessage({
      agentId: "michael",
      triggerAt: new Date("2025-06-01T09:00:00Z"),
      prompt: "Start the morning meeting",
    });

    expect(result).toEqual(MOCK_MSG);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("createScheduledMessage throws when insert returns no rows", async () => {
    mockDb.insert.mockReturnValue(mockChain([]));

    const { createScheduledMessage } = await import("../scheduler");
    await expect(
      createScheduledMessage({
        agentId: "michael",
        triggerAt: new Date("2025-06-01T09:00:00Z"),
        prompt: "Start the morning meeting",
      }),
    ).rejects.toThrow("Insert returned no rows");
  });

  it("cancelScheduledMessage returns true when found and pending", async () => {
    const cancelled = createMockScheduledMessage({ status: "cancelled" });
    mockDb.update.mockReturnValue(mockChain([cancelled]));

    const { cancelScheduledMessage } = await import("../scheduler");
    const result = await cancelScheduledMessage("sched-1");

    expect(result).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("cancelScheduledMessage returns false when not found", async () => {
    mockDb.update.mockReturnValue(mockChain([]));

    const { cancelScheduledMessage } = await import("../scheduler");
    const result = await cancelScheduledMessage("nonexistent");

    expect(result).toBe(false);
  });

  it("cancelScheduledMessage returns false when already fired", async () => {
    // The WHERE clause includes status='pending', so a fired message returns no rows
    mockDb.update.mockReturnValue(mockChain([]));

    const { cancelScheduledMessage } = await import("../scheduler");
    const result = await cancelScheduledMessage("sched-fired");

    expect(result).toBe(false);
  });

  it("listScheduledMessages returns ordered list", async () => {
    const msgs = [
      createMockScheduledMessage({ id: "sched-2", triggerAt: new Date("2025-07-01") }),
      createMockScheduledMessage({ id: "sched-1", triggerAt: new Date("2025-06-01") }),
    ];
    mockDb.select.mockReturnValue(mockChain(msgs));

    const { listScheduledMessages } = await import("../scheduler");
    const result = await listScheduledMessages();

    expect(result).toEqual(msgs);
    expect(result).toHaveLength(2);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("listScheduledMessages returns empty array when none exist", async () => {
    mockDb.select.mockReturnValue(mockChain([]));

    const { listScheduledMessages } = await import("../scheduler");
    const result = await listScheduledMessages();

    expect(result).toEqual([]);
  });
});
