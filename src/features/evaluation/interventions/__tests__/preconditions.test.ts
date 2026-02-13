import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStartSpan = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();
const mockMetricsCount = vi.fn();
const mockMetricsDistribution = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  startSpan: (...args: unknown[]): unknown => mockStartSpan(...args),
  logger: {
    info: (...args: unknown[]): void => {
      mockLoggerInfo(...args);
    },
    warn: (...args: unknown[]): void => {
      mockLoggerWarn(...args);
    },
    error: (...args: unknown[]): void => {
      mockLoggerError(...args);
    },
  },
  metrics: {
    count: (...args: unknown[]): void => {
      mockMetricsCount(...args);
    },
    distribution: (...args: unknown[]): void => {
      mockMetricsDistribution(...args);
    },
  },
}));

mockStartSpan.mockImplementation(
  (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
);

// Mock proposition engine
const mockCheckProposition = vi.fn();
const mockScoreProposition = vi.fn();
vi.mock("@/features/evaluation/proposition-engine", () => ({
  checkProposition: (...args: unknown[]): unknown =>
    mockCheckProposition(...args),
  scoreProposition: (...args: unknown[]): unknown =>
    mockScoreProposition(...args),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  evaluateTextualPrecondition,
  evaluateFunctionalPrecondition,
  evaluatePropositionalPrecondition,
} from "../preconditions";
import type { ScoringContext } from "@/features/evaluation/proposition-engine";
import type { Proposition } from "@/features/evaluation/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultContext: ScoringContext = {
  trajectory: [
    { type: "action", agentName: "Michael Scott", text: "That's what she said!" },
  ],
};

const defaultProposition: Proposition = {
  id: "test-prop-1",
  claim: "The agent stays in character",
  weight: 1,
  inverted: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("preconditions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
    );
  });

  // --- evaluateTextualPrecondition ---

  describe("evaluateTextualPrecondition", () => {
    it("returns passed=true when checkProposition returns true", async () => {
      mockCheckProposition.mockResolvedValue({
        result: true,
        reasoning: "Claim is valid",
        confidence: 0.9,
        tokenUsage: { input_tokens: 50, output_tokens: 20 },
      });

      const result = await evaluateTextualPrecondition(
        "The agent is being repetitive",
        defaultContext,
      );

      expect(result.type).toBe("textual");
      expect(result.passed).toBe(true);
      expect(result.reasoning).toBe("Claim is valid");
      expect(result.tokenUsage).toEqual({
        input_tokens: 50,
        output_tokens: 20,
      });
    });

    it("returns passed=false when checkProposition returns false", async () => {
      mockCheckProposition.mockResolvedValue({
        result: false,
        reasoning: "Claim is not supported",
        confidence: 0.8,
        tokenUsage: { input_tokens: 50, output_tokens: 20 },
      });

      const result = await evaluateTextualPrecondition(
        "The agent is off-topic",
        defaultContext,
      );

      expect(result.type).toBe("textual");
      expect(result.passed).toBe(false);
    });

    it("creates a one-off proposition from the claim string", async () => {
      mockCheckProposition.mockResolvedValue({
        result: true,
        reasoning: "OK",
        confidence: 0.9,
        tokenUsage: { input_tokens: 50, output_tokens: 20 },
      });

      await evaluateTextualPrecondition("test claim", defaultContext);

      expect(mockCheckProposition).toHaveBeenCalledTimes(1);
      const callArgs = mockCheckProposition.mock.calls[0] as unknown[];
      const proposition = callArgs[0] as Proposition;
      expect(proposition.claim).toBe("test claim");
      expect(proposition.weight).toBe(1);
      expect(proposition.inverted).toBe(false);
      expect(proposition.id).toMatch(/^textual-precondition-/);
    });
  });

  // --- evaluateFunctionalPrecondition ---

  describe("evaluateFunctionalPrecondition", () => {
    it("returns passed=true when function returns true", () => {
      const fn = () => true;
      const result = evaluateFunctionalPrecondition(fn, [
        { type: "agent", id: "michael" },
      ]);

      expect(result.type).toBe("functional");
      expect(result.passed).toBe(true);
    });

    it("returns passed=false when function returns false", () => {
      const fn = () => false;
      const result = evaluateFunctionalPrecondition(fn, [
        { type: "agent", id: "michael" },
      ]);

      expect(result.type).toBe("functional");
      expect(result.passed).toBe(false);
    });

    it("passes targets to the function", () => {
      const targets = [
        { type: "agent" as const, id: "michael" },
        { type: "channel" as const, id: "general" },
      ];
      const fn = vi.fn().mockReturnValue(true);

      evaluateFunctionalPrecondition(fn, targets);

      expect(fn).toHaveBeenCalledWith(targets);
    });

    it("does not have tokenUsage (no LLM call)", () => {
      const result = evaluateFunctionalPrecondition(() => true, []);
      expect(result.tokenUsage).toBeUndefined();
    });
  });

  // --- evaluatePropositionalPrecondition ---

  describe("evaluatePropositionalPrecondition", () => {
    describe("WITH threshold (inverted logic)", () => {
      it("returns passed=false when score >= threshold (condition already met)", async () => {
        mockScoreProposition.mockResolvedValue({
          score: 8,
          reasoning: "High convergence",
          confidence: 0.9,
          tokenUsage: { input_tokens: 100, output_tokens: 50 },
        });

        const result = await evaluatePropositionalPrecondition(
          defaultProposition,
          defaultContext,
          7,
        );

        expect(result.type).toBe("propositional");
        expect(result.passed).toBe(false); // score 8 >= threshold 7 => NOT passed
        expect(result.score).toBe(8);
      });

      it("returns passed=true when score < threshold (intervention needed)", async () => {
        mockScoreProposition.mockResolvedValue({
          score: 4,
          reasoning: "Low convergence",
          confidence: 0.8,
          tokenUsage: { input_tokens: 100, output_tokens: 50 },
        });

        const result = await evaluatePropositionalPrecondition(
          defaultProposition,
          defaultContext,
          7,
        );

        expect(result.type).toBe("propositional");
        expect(result.passed).toBe(true); // score 4 < threshold 7 => passed
        expect(result.score).toBe(4);
      });

      it("returns passed=false when score equals threshold exactly", async () => {
        mockScoreProposition.mockResolvedValue({
          score: 7,
          reasoning: "At threshold",
          confidence: 0.85,
          tokenUsage: { input_tokens: 100, output_tokens: 50 },
        });

        const result = await evaluatePropositionalPrecondition(
          defaultProposition,
          defaultContext,
          7,
        );

        expect(result.passed).toBe(false); // score 7 >= threshold 7 => NOT passed
      });

      it("uses scoreProposition (not checkProposition) when threshold set", async () => {
        mockScoreProposition.mockResolvedValue({
          score: 5,
          reasoning: "OK",
          confidence: 0.8,
          tokenUsage: { input_tokens: 100, output_tokens: 50 },
        });

        await evaluatePropositionalPrecondition(
          defaultProposition,
          defaultContext,
          7,
        );

        expect(mockScoreProposition).toHaveBeenCalledTimes(1);
        expect(mockCheckProposition).not.toHaveBeenCalled();
      });
    });

    describe("WITHOUT threshold (boolean check)", () => {
      it("returns passed=true when checkProposition returns true", async () => {
        mockCheckProposition.mockResolvedValue({
          result: true,
          reasoning: "Proposition holds",
          confidence: 0.9,
          tokenUsage: { input_tokens: 100, output_tokens: 50 },
        });

        const result = await evaluatePropositionalPrecondition(
          defaultProposition,
          defaultContext,
        );

        expect(result.type).toBe("propositional");
        expect(result.passed).toBe(true);
        expect(result.reasoning).toBe("Proposition holds");
      });

      it("returns passed=false when checkProposition returns false", async () => {
        mockCheckProposition.mockResolvedValue({
          result: false,
          reasoning: "Proposition does not hold",
          confidence: 0.7,
          tokenUsage: { input_tokens: 100, output_tokens: 50 },
        });

        const result = await evaluatePropositionalPrecondition(
          defaultProposition,
          defaultContext,
        );

        expect(result.type).toBe("propositional");
        expect(result.passed).toBe(false);
      });

      it("uses checkProposition (not scoreProposition) without threshold", async () => {
        mockCheckProposition.mockResolvedValue({
          result: true,
          reasoning: "OK",
          confidence: 0.9,
          tokenUsage: { input_tokens: 100, output_tokens: 50 },
        });

        await evaluatePropositionalPrecondition(
          defaultProposition,
          defaultContext,
        );

        expect(mockCheckProposition).toHaveBeenCalledTimes(1);
        expect(mockScoreProposition).not.toHaveBeenCalled();
      });
    });
  });
});
