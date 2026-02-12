import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Agent, Run } from "@/db/schema";
import { createMockAgent, createMockRun } from "@/tests/factories";

const mockGetAgent = vi.fn<(id: string) => Promise<Agent | undefined>>();
const mockEnqueueRun = vi.fn<(...args: unknown[]) => Promise<Run>>();

vi.mock("@/db/queries", () => ({
  getAgent: (...args: unknown[]) => mockGetAgent(...(args as [string])),
}));

vi.mock("@/agents/mailbox", () => ({
  enqueueRun: (...args: unknown[]) => mockEnqueueRun(...args),
  processNextRun: vi.fn(),
}));

vi.mock("@/agents/orchestrator", () => ({
  executeRun: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: vi.fn() };
});

const MOCK_AGENT = createMockAgent({ id: "michael" });
const MOCK_RUN = createMockRun({ agentId: "michael", channelId: "general" });

describe("POST /api/agents/[agentId]/invoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with runId for valid request", async () => {
    mockGetAgent.mockResolvedValue(MOCK_AGENT);
    mockEnqueueRun.mockResolvedValue(MOCK_RUN);

    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/agents/michael/invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: "general" }),
    });
    const response = await POST(request, {
      params: Promise.resolve({ agentId: "michael" }),
    });
    const body = (await response.json()) as { runId: string; status: string };

    expect(response.status).toBe(200);
    expect(body.runId).toBe(MOCK_RUN.id);
    expect(body.status).toBe("created");
  });

  it("returns 404 for unknown agent", async () => {
    mockGetAgent.mockResolvedValue(undefined);

    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/agents/unknown/invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: "general" }),
    });
    const response = await POST(request, {
      params: Promise.resolve({ agentId: "unknown" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 400 when channelId is missing", async () => {
    mockGetAgent.mockResolvedValue(MOCK_AGENT);

    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/agents/michael/invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await POST(request, {
      params: Promise.resolve({ agentId: "michael" }),
    });

    expect(response.status).toBe(400);
  });
});
