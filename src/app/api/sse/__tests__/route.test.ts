import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAdd = vi.fn();
const mockRemove = vi.fn();

vi.mock("@/messages/sse-registry", () => ({
  connectionRegistry: { add: mockAdd, remove: mockRemove },
}));

vi.mock("@/lib/telemetry", () => ({
  logInfo: vi.fn(),
}));

describe("GET /api/sse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns text/event-stream content type", async () => {
    const { GET } = await import("../route");

    const controller = new AbortController();
    const request = new Request("http://localhost/api/sse", {
      signal: controller.signal,
    });

    const response = GET(request);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(response.headers.get("Connection")).toBe("keep-alive");

    controller.abort();
  });

  it("registers connection on stream start", async () => {
    const { GET } = await import("../route");

    const controller = new AbortController();
    const request = new Request("http://localhost/api/sse", {
      signal: controller.signal,
    });

    const response = GET(request);

    // Read the first chunk to trigger the start() callback
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    await reader?.read();

    expect(mockAdd).toHaveBeenCalledOnce();
    expect(mockAdd.mock.calls[0]?.[0]).toEqual(expect.any(String)); // connection ID

    controller.abort();
    reader?.releaseLock();
  });

  it("removes connection from registry on client disconnect", async () => {
    const { GET } = await import("../route");

    const controller = new AbortController();
    const request = new Request("http://localhost/api/sse", {
      signal: controller.signal,
    });

    const response = GET(request);
    const reader = response.body?.getReader();
    await reader?.read();

    const connectionId = mockAdd.mock.calls[0]?.[0] as string;

    controller.abort();
    // Allow async abort handler to fire
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockRemove).toHaveBeenCalledWith(connectionId);
    reader?.releaseLock();
  });
});
