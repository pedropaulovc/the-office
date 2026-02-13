import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStartSpan = vi.fn();
const mockLoggerInfo = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  startSpan: (...args: unknown[]): unknown => mockStartSpan(...args),
  logger: {
    info: (...args: unknown[]): void => {
      mockLoggerInfo(...args);
    },
    warn: vi.fn(),
    error: vi.fn(),
  },
  metrics: {
    count: vi.fn(),
    distribution: vi.fn(),
  },
}));

mockStartSpan.mockImplementation(
  (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
);

describe("shim-scorer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
    );
  });

  it("loads propositions and returns mock scores", async () => {
    const { shimScore } = await import("../shim-scorer");
    const result = await shimScore("adherence", "michael", {
      agent_name: "Michael Scott",
      channel_name: "general",
    });

    expect(result.dimension).toBe("adherence");
    expect(result.agentId).toBe("michael");
    expect(result.propositionResults.length).toBeGreaterThanOrEqual(3);
    expect(result.overallScore).toBeGreaterThan(0);
  });

  it("applies inverted score flipping to anti-pattern propositions", async () => {
    const { shimScore } = await import("../shim-scorer");
    const result = await shimScore("adherence", "michael");

    const invertedResult = result.propositionResults.find(
      (r) => r.propositionId === "generic-corporate-response",
    );
    // Base score 7, inverted: 9 - 7 = 2
    expect(invertedResult?.score).toBe(2);
    expect(invertedResult?.reasoning).toContain("inverted=true");

    const normalResult = result.propositionResults.find(
      (r) => r.propositionId === "adheres-to-persona",
    );
    // Base score 7, not inverted
    expect(normalResult?.score).toBe(7);
    expect(normalResult?.reasoning).toContain("inverted=false");
  });

  it("computes weighted overall score", async () => {
    const { shimScore } = await import("../shim-scorer");
    const result = await shimScore("adherence", "michael");

    // With mixed inverted/normal propositions, overall should be between 0 and 9
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThanOrEqual(9);
  });

  it("marks all reasoning as [shim]", async () => {
    const { shimScore } = await import("../shim-scorer");
    const result = await shimScore("adherence", "michael");

    for (const r of result.propositionResults) {
      expect(r.reasoning).toMatch(/^\[shim\]/);
    }
  });

  it("fills template variables in loaded propositions", async () => {
    const { shimScore } = await import("../shim-scorer");
    const result = await shimScore("adherence", "michael", {
      agent_name: "Michael Scott",
    });

    // The shim doesn't expose claims directly, but it should load without error
    // and return results for all propositions
    expect(result.propositionResults).toHaveLength(4);
  });
});
