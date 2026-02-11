import { describe, it, expect, vi } from "vitest";

const mockLogInfo = vi.fn();

vi.mock("@/lib/telemetry", () => ({
  logInfo: (msg: string, attrs: Record<string, string>) => { mockLogInfo(msg, attrs); },
}));

describe("sse-registry", () => {
  it("broadcast is callable without error and logs via telemetry", async () => {
    const { connectionRegistry } = await import("../sse-registry");

    connectionRegistry.broadcast("general", {
      type: "agent_typing",
      channelId: "general",
      agentId: "michael",
    });

    expect(mockLogInfo).toHaveBeenCalledWith("sse.broadcast (no-op)", {
      channelId: "general",
      eventType: "agent_typing",
    });
  });
});
