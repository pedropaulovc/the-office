import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — vi.mock factories are hoisted, so use vi.hoisted for shared state
// ---------------------------------------------------------------------------

vi.mock("@/lib/telemetry", () => ({
  withSpan: vi.fn((_name: string, _op: string, fn: () => unknown) => fn()),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  countMetric: vi.fn(),
  distributionMetric: vi.fn(),
}));

const { state } = vi.hoisted(() => {
  const state = {
    correctionRows: [] as { tokenUsage: unknown }[],
    interventionRows: [] as { tokenUsage: unknown }[],
    selectCallCount: 0,
  };
  return { state };
});

vi.mock("@/db/client", () => {
  function makeChain(resolvedValue: () => { tokenUsage: unknown }[]) {
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => resolvedValue()),
      }),
    };
  }

  const mockSelect = vi.fn().mockImplementation(() => {
    state.selectCallCount++;
    if (state.selectCallCount % 2 === 1) {
      return makeChain(() => state.correctionRows);
    }
    return makeChain(() => state.interventionRows);
  });

  return {
    db: { select: mockSelect },
  };
});

vi.mock("@/db/schema", () => ({
  correctionLogs: { agentId: "agent_id", createdAt: "created_at" },
  interventionLogs: { agentId: "agent_id", createdAt: "created_at" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------

import { getCostSummary } from "@/features/evaluation/cost-tracker";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Claude Haiku rates (must match the source)
const INPUT_COST_PER_TOKEN = 0.25 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 1.25 / 1_000_000;

describe("cost tracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.correctionRows = [];
    state.interventionRows = [];
    state.selectCallCount = 0;
  });

  it("returns zero costs when no logs exist", async () => {
    const summary = await getCostSummary();

    expect(summary.agentId).toBeNull();
    expect(summary.correctionTokens).toEqual({ input: 0, output: 0 });
    expect(summary.interventionTokens).toEqual({ input: 0, output: 0 });
    expect(summary.totalTokens).toEqual({ input: 0, output: 0 });
    expect(summary.estimatedCostUsd).toBe(0);
  });

  it("aggregates correction log token usage correctly", async () => {
    state.correctionRows = [
      { tokenUsage: { input_tokens: 100, output_tokens: 50 } },
      { tokenUsage: { input_tokens: 200, output_tokens: 150 } },
    ];

    const summary = await getCostSummary();

    expect(summary.correctionTokens).toEqual({ input: 300, output: 200 });
  });

  it("aggregates intervention log token usage correctly", async () => {
    state.interventionRows = [
      { tokenUsage: { input_tokens: 400, output_tokens: 100 } },
      { tokenUsage: { input_tokens: 600, output_tokens: 200 } },
    ];

    const summary = await getCostSummary();

    expect(summary.interventionTokens).toEqual({ input: 1000, output: 300 });
  });

  it("calculates estimated USD cost correctly", async () => {
    state.correctionRows = [
      { tokenUsage: { input_tokens: 1000, output_tokens: 500 } },
    ];
    state.interventionRows = [
      { tokenUsage: { input_tokens: 2000, output_tokens: 1000 } },
    ];

    const summary = await getCostSummary();

    const expectedInput = 3000;
    const expectedOutput = 1500;
    const expectedCost =
      expectedInput * INPUT_COST_PER_TOKEN +
      expectedOutput * OUTPUT_COST_PER_TOKEN;

    expect(summary.totalTokens).toEqual({
      input: expectedInput,
      output: expectedOutput,
    });
    expect(summary.estimatedCostUsd).toBeCloseTo(expectedCost);
  });

  it("handles null/missing token usage in logs", async () => {
    state.correctionRows = [
      { tokenUsage: null },
      { tokenUsage: { input_tokens: 100 } },
      { tokenUsage: { output_tokens: 50 } },
      { tokenUsage: {} },
    ];
    state.interventionRows = [{ tokenUsage: null }];

    const summary = await getCostSummary();

    expect(summary.correctionTokens).toEqual({ input: 100, output: 50 });
    expect(summary.interventionTokens).toEqual({ input: 0, output: 0 });
    expect(summary.totalTokens).toEqual({ input: 100, output: 50 });
  });
});
