import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports of module under test
// ---------------------------------------------------------------------------

vi.mock("@/lib/telemetry", () => ({
  withSpan: vi.fn((_name: string, _op: string, fn: () => unknown) => fn()),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  countMetric: vi.fn(),
  distributionMetric: vi.fn(),
}));

const mockGetAgentEvalConfig = vi.fn();

vi.mock("@/db/queries", () => ({
  getAgentEvalConfig: (...args: unknown[]) =>
    mockGetAgentEvalConfig(...args),
}));

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------

import {
  buildResolvedConfig,
  resolveConfig,
  DEFAULT_RESOLVED_CONFIG,
} from "@/features/evaluation/config";
import type { AgentEvaluationConfig } from "@/db/schema";
import { DEFAULT_PIPELINE_CONFIG } from "@/features/evaluation/gates/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbConfig(
  overrides: Partial<AgentEvaluationConfig> = {},
): AgentEvaluationConfig {
  return {
    agentId: "michael",
    gateAdherenceEnabled: true,
    gateAdherenceThreshold: 8.0,
    gateConsistencyEnabled: false,
    gateConsistencyThreshold: 6.5,
    gateFluencyEnabled: true,
    gateFluencyThreshold: 5.0,
    gateSuitabilityEnabled: false,
    gateSuitabilityThreshold: 7.0,
    gateSimilarityEnabled: true,
    maxActionSimilarity: 0.4,
    enableRegeneration: false,
    enableDirectCorrection: true,
    maxCorrectionAttempts: 3,
    continueOnFailure: false,
    minimumRequiredQtyOfActions: 2,
    antiConvergenceEnabled: true,
    convergenceThreshold: 0.8,
    varietyInterventionEnabled: true,
    varietyMessageThreshold: 10,
    repetitionSuppressionEnabled: true,
    repetitionThreshold: 0.5,
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("evaluation config resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("buildResolvedConfig maps DB fields to pipeline config", () => {
    const dbConfig = makeDbConfig();
    const result = buildResolvedConfig(dbConfig);

    expect(result.pipeline.dimensions.persona_adherence).toEqual({
      enabled: true,
      threshold: 8.0,
    });
    expect(result.pipeline.dimensions.self_consistency).toEqual({
      enabled: false,
      threshold: 6.5,
    });
    expect(result.pipeline.dimensions.fluency).toEqual({
      enabled: true,
      threshold: 5.0,
    });
    expect(result.pipeline.dimensions.suitability).toEqual({
      enabled: false,
      threshold: 7.0,
    });
    expect(result.pipeline.similarity).toEqual({
      enabled: true,
      threshold: 0.4,
    });
    expect(result.pipeline.enableRegeneration).toBe(false);
    expect(result.pipeline.enableDirectCorrection).toBe(true);
    expect(result.pipeline.maxCorrectionAttempts).toBe(3);
    expect(result.pipeline.continueOnFailure).toBe(false);
    expect(result.pipeline.minimumRequiredQtyOfActions).toBe(2);
  });

  it("buildResolvedConfig maps DB fields to intervention config", () => {
    const dbConfig = makeDbConfig();
    const result = buildResolvedConfig(dbConfig);

    expect(result.interventions).toEqual({
      antiConvergenceEnabled: true,
      convergenceThreshold: 0.8,
      varietyInterventionEnabled: true,
      varietyMessageThreshold: 10,
    });
  });

  it("buildResolvedConfig maps DB fields to repetition config", () => {
    const dbConfig = makeDbConfig();
    const result = buildResolvedConfig(dbConfig);

    expect(result.repetition).toEqual({
      enabled: true,
      threshold: 0.5,
    });
  });

  it("resolveConfig returns defaults when no DB config exists", async () => {
    mockGetAgentEvalConfig.mockResolvedValue(undefined);

    const result = await resolveConfig("unknown-agent");

    expect(mockGetAgentEvalConfig).toHaveBeenCalledWith("unknown-agent");
    expect(result).toEqual(DEFAULT_RESOLVED_CONFIG);
  });

  it("resolveConfig returns resolved config when DB config exists", async () => {
    const dbConfig = makeDbConfig({ agentId: "dwight" });
    mockGetAgentEvalConfig.mockResolvedValue(dbConfig);

    const result = await resolveConfig("dwight");

    expect(mockGetAgentEvalConfig).toHaveBeenCalledWith("dwight");
    expect(result.pipeline.dimensions.persona_adherence.enabled).toBe(true);
    expect(result.pipeline.dimensions.persona_adherence.threshold).toBe(8.0);
    expect(result.interventions.antiConvergenceEnabled).toBe(true);
    expect(result.repetition.enabled).toBe(true);
    expect(result.repetition.threshold).toBe(0.5);
  });

  it("DEFAULT_RESOLVED_CONFIG has all mechanisms disabled", () => {
    const cfg = DEFAULT_RESOLVED_CONFIG;

    // All gate dimensions disabled
    expect(cfg.pipeline.dimensions.persona_adherence.enabled).toBe(false);
    expect(cfg.pipeline.dimensions.self_consistency.enabled).toBe(false);
    expect(cfg.pipeline.dimensions.fluency.enabled).toBe(false);
    expect(cfg.pipeline.dimensions.suitability.enabled).toBe(false);
    expect(cfg.pipeline.similarity.enabled).toBe(false);

    // Pipeline defaults match DEFAULT_PIPELINE_CONFIG
    expect(cfg.pipeline).toEqual(DEFAULT_PIPELINE_CONFIG);

    // Interventions disabled
    expect(cfg.interventions.antiConvergenceEnabled).toBe(false);
    expect(cfg.interventions.varietyInterventionEnabled).toBe(false);

    // Repetition disabled
    expect(cfg.repetition.enabled).toBe(false);
  });
});
