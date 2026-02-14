import { describe, it, expect, beforeEach } from "vitest";
import {
  createMockCorrectionLog,
  resetCorrectionLogFactoryCounter,
} from "@/tests/factories/correction-log";
import { computeStats } from "../statistics";

describe("computeStats", () => {
  beforeEach(() => {
    resetCorrectionLogFactoryCounter();
  });

  it("returns all zeros for empty logs", () => {
    const stats = computeStats([]);

    expect(stats.totalActions).toBe(0);
    expect(stats.originalPassCount).toBe(0);
    expect(stats.originalPassRate).toBe(0);
    expect(stats.regenerationCount).toBe(0);
    expect(stats.regenerationSuccessCount).toBe(0);
    expect(stats.regenerationFailureRate).toBe(0);
    expect(stats.regenerationMeanScore).toBe(0);
    expect(stats.regenerationSdScore).toBe(0);
    expect(stats.directCorrectionCount).toBe(0);
    expect(stats.directCorrectionSuccessCount).toBe(0);
    expect(stats.directCorrectionFailureRate).toBe(0);
    expect(stats.directCorrectionMeanScore).toBe(0);
    expect(stats.directCorrectionSdScore).toBe(0);
    expect(stats.forcedThroughCount).toBe(0);
    expect(stats.similarityFailureCount).toBe(0);
    expect(stats.perDimensionFailureCounts.persona_adherence).toBe(0);
    expect(stats.perDimensionFailureCounts.self_consistency).toBe(0);
    expect(stats.perDimensionFailureCounts.fluency).toBe(0);
    expect(stats.perDimensionFailureCounts.suitability).toBe(0);
    expect(stats.perDimensionMeanScores.persona_adherence).toBe(0);
  });

  it("reports originalPassRate = 1.0 when all logs passed", () => {
    const logs = [
      createMockCorrectionLog({ outcome: "passed", stage: "original" }),
      createMockCorrectionLog({ outcome: "passed", stage: "original" }),
      createMockCorrectionLog({ outcome: "passed", stage: "original" }),
    ];

    const stats = computeStats(logs);

    expect(stats.totalActions).toBe(3);
    expect(stats.originalPassCount).toBe(3);
    expect(stats.originalPassRate).toBe(1.0);
    expect(stats.regenerationCount).toBe(0);
    expect(stats.directCorrectionCount).toBe(0);
    expect(stats.forcedThroughCount).toBe(0);
  });

  it("counts mixed outcomes correctly", () => {
    const logs = [
      createMockCorrectionLog({ outcome: "passed", stage: "original" }),
      createMockCorrectionLog({ outcome: "regeneration_success", stage: "regeneration", totalScore: 20 }),
      createMockCorrectionLog({ outcome: "forced_through", stage: "regeneration", totalScore: 10 }),
      createMockCorrectionLog({ outcome: "direct_correction_success", stage: "direct_correction", totalScore: 18 }),
      createMockCorrectionLog({ outcome: "forced_through", stage: "direct_correction", totalScore: 6 }),
    ];

    const stats = computeStats(logs);

    expect(stats.totalActions).toBe(5);
    expect(stats.originalPassCount).toBe(1);
    expect(stats.originalPassRate).toBeCloseTo(0.2);
    expect(stats.regenerationCount).toBe(2);
    expect(stats.regenerationSuccessCount).toBe(1);
    expect(stats.regenerationFailureRate).toBeCloseTo(0.5);
    expect(stats.directCorrectionCount).toBe(2);
    expect(stats.directCorrectionSuccessCount).toBe(1);
    expect(stats.directCorrectionFailureRate).toBeCloseTo(0.5);
    expect(stats.forcedThroughCount).toBe(2);
  });

  it("counts per-dimension failures from JSONB dimensionScores", () => {
    const logs = [
      createMockCorrectionLog({
        dimensionScores: [
          { dimension: "persona_adherence", score: 4, passed: false },
          { dimension: "fluency", score: 8, passed: true },
        ],
      }),
      createMockCorrectionLog({
        dimensionScores: [
          { dimension: "persona_adherence", score: 6, passed: false },
          { dimension: "fluency", score: 3, passed: false },
          { dimension: "suitability", score: 9, passed: true },
        ],
      }),
    ];

    const stats = computeStats(logs);

    expect(stats.perDimensionFailureCounts.persona_adherence).toBe(2);
    expect(stats.perDimensionFailureCounts.fluency).toBe(1);
    expect(stats.perDimensionFailureCounts.suitability).toBe(0);
    expect(stats.perDimensionFailureCounts.self_consistency).toBe(0);

    expect(stats.perDimensionMeanScores.persona_adherence).toBeCloseTo(5.0);
    expect(stats.perDimensionMeanScores.fluency).toBeCloseTo(5.5);
    expect(stats.perDimensionMeanScores.suitability).toBeCloseTo(9.0);
    expect(stats.perDimensionMeanScores.self_consistency).toBe(0);
  });

  it("calculates mean and standard deviation for regeneration scores", () => {
    const logs = [
      createMockCorrectionLog({ stage: "regeneration", totalScore: 10 }),
      createMockCorrectionLog({ stage: "regeneration", totalScore: 20 }),
      createMockCorrectionLog({ stage: "regeneration", totalScore: 30 }),
    ];

    const stats = computeStats(logs);

    expect(stats.regenerationMeanScore).toBeCloseTo(20);
    // Sample SD of [10, 20, 30]: sqrt(((10-20)^2 + (20-20)^2 + (30-20)^2) / 2) = sqrt(200/2) = 10
    expect(stats.regenerationSdScore).toBeCloseTo(10);
  });

  it("returns SD of 0 for a single regeneration score", () => {
    const logs = [
      createMockCorrectionLog({ stage: "regeneration", totalScore: 15 }),
    ];

    const stats = computeStats(logs);

    expect(stats.regenerationMeanScore).toBeCloseTo(15);
    expect(stats.regenerationSdScore).toBe(0);
  });

  it("counts similarity failures where score > 0.6", () => {
    const logs = [
      createMockCorrectionLog({ similarityScore: 0.3 }),
      createMockCorrectionLog({ similarityScore: 0.7 }),
      createMockCorrectionLog({ similarityScore: 0.9 }),
      createMockCorrectionLog({ similarityScore: null }),
      createMockCorrectionLog({ similarityScore: 0.6 }),
    ];

    const stats = computeStats(logs);

    // Only 0.7 and 0.9 are > 0.6
    expect(stats.similarityFailureCount).toBe(2);
  });

  it("counts regeneration_requested toward regenerationCount but not regenerationSuccessCount", () => {
    const logs = [
      createMockCorrectionLog({ outcome: "regeneration_requested", stage: "original", totalScore: 10 }),
      createMockCorrectionLog({ outcome: "regeneration_requested", stage: "regeneration", totalScore: 14 }),
      createMockCorrectionLog({ outcome: "regeneration_success", stage: "regeneration", totalScore: 22 }),
    ];

    const stats = computeStats(logs);

    expect(stats.regenerationCount).toBe(3);
    expect(stats.regenerationSuccessCount).toBe(1);
    expect(stats.regenerationFailureRate).toBeCloseTo(2 / 3);
  });

  it("ignores non-array dimensionScores gracefully", () => {
    const logs = [
      createMockCorrectionLog({ dimensionScores: null as unknown as [] }),
      createMockCorrectionLog({ dimensionScores: "bad data" as unknown as [] }),
      createMockCorrectionLog({
        dimensionScores: [
          { dimension: "fluency", score: 7, passed: true },
        ],
      }),
    ];

    const stats = computeStats(logs);

    expect(stats.perDimensionMeanScores.fluency).toBeCloseTo(7);
    expect(stats.perDimensionFailureCounts.fluency).toBe(0);
  });
});
