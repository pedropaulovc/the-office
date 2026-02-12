import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLogInfo = vi.fn();
const mockCountMetric = vi.fn();

vi.mock("@/lib/telemetry", () => ({
  withSpan: (_n: string, _o: string, fn: () => unknown) => fn(),
  logInfo: (...args: unknown[]) => { mockLogInfo(...args); },
  countMetric: (...args: unknown[]) => { mockCountMetric(...args); },
}));

describe("ConnectionRegistry", () => {
  beforeEach(() => {
    vi.resetModules();
    mockLogInfo.mockClear();
    mockCountMetric.mockClear();
  });

  it("add() registers a controller and size increases", async () => {
    const { connectionRegistry } = await import("../sse-registry");
    const controller = { enqueue: vi.fn(), close: vi.fn() } as unknown as ReadableStreamDefaultController<Uint8Array>;

    connectionRegistry.add("conn-1", controller);

    expect(connectionRegistry.size).toBe(1);
  });

  it("remove() unregisters a controller", async () => {
    const { connectionRegistry } = await import("../sse-registry");
    const controller = { enqueue: vi.fn(), close: vi.fn() } as unknown as ReadableStreamDefaultController<Uint8Array>;

    connectionRegistry.add("conn-1", controller);
    connectionRegistry.remove("conn-1");

    expect(connectionRegistry.size).toBe(0);
  });

  it("broadcast() sends encoded event to all connected controllers", async () => {
    const { connectionRegistry } = await import("../sse-registry");
    const enqueue1 = vi.fn();
    const enqueue2 = vi.fn();
    const c1 = { enqueue: enqueue1, close: vi.fn() } as unknown as ReadableStreamDefaultController<Uint8Array>;
    const c2 = { enqueue: enqueue2, close: vi.fn() } as unknown as ReadableStreamDefaultController<Uint8Array>;

    connectionRegistry.add("a", c1);
    connectionRegistry.add("b", c2);

    connectionRegistry.broadcast("general", {
      type: "message_created",
      channelId: "general",
      data: { id: "msg-1" },
    });

    expect(enqueue1).toHaveBeenCalledOnce();
    expect(enqueue2).toHaveBeenCalledOnce();

    // Verify SSE format: "data: {...}\n\n"
    const payload = new TextDecoder().decode(enqueue1.mock.calls[0]![0] as Uint8Array);
    expect(payload).toContain("data: ");
    expect(payload.endsWith("\n\n")).toBe(true);
    const parsed = JSON.parse(payload.replace("data: ", "").trim());
    expect(parsed.type).toBe("message_created");
  });

  it("broadcast() removes controllers that throw on enqueue", async () => {
    const { connectionRegistry } = await import("../sse-registry");
    const good = { enqueue: vi.fn(), close: vi.fn() } as unknown as ReadableStreamDefaultController<Uint8Array>;
    const bad = {
      enqueue: vi.fn().mockImplementation(() => { throw new Error("closed"); }),
      close: vi.fn(),
    } as unknown as ReadableStreamDefaultController<Uint8Array>;

    connectionRegistry.add("good", good);
    connectionRegistry.add("bad", bad);

    connectionRegistry.broadcast("ch", { type: "agent_typing", channelId: "ch", agentId: "michael" });

    expect(connectionRegistry.size).toBe(1);
    expect(good.enqueue).toHaveBeenCalledOnce();
  });
});
