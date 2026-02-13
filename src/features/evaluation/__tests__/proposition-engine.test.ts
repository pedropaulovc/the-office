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

const mockMessagesCreate = vi.fn();

vi.mock("@/lib/anthropic", () => ({
  getAnthropicClient: () => ({
    messages: { create: mockMessagesCreate },
  }),
  JUDGE_MODEL: "claude-haiku-4-5-20251001",
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  formatTrajectory,
  SCORING_RUBRIC,
  buildJudgeSystemPrompt,
  buildScoreUserPrompt,
  buildCheckUserPrompt,
  buildBatchScoreUserPrompt,
  parseScoreResponse,
  parseCheckResponse,
  parseBatchScoreResponse,
  scoreProposition,
  checkProposition,
  scorePropositions,
} from "../proposition-engine";
import type {
  TrajectoryEntry,
  ScoringContext,
} from "../proposition-engine";
import type { Proposition } from "@/features/evaluation/types";

// ---------------------------------------------------------------------------
// Console suppression for tests that trigger logWarn/logError
// (telemetry.ts calls console.warn/error, which the global test setup
// intercepts and throws on — so we need to temporarily suppress them)
// ---------------------------------------------------------------------------

function silenceConsole(): () => void {
  const savedWarn = console.warn;
  const savedError = console.error;
  console.warn = vi.fn();
  console.error = vi.fn();
  return () => {
    console.warn = savedWarn;
    console.error = savedError;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProposition(overrides?: Partial<Proposition>): Proposition {
  return {
    id: "test-prop",
    claim: "The agent is helpful",
    weight: 1,
    inverted: false,
    ...overrides,
  };
}

function makeContext(overrides?: Partial<ScoringContext>): ScoringContext {
  return {
    trajectory: [
      { type: "action", agentName: "Michael", text: "Hello everyone!" },
      { type: "stimulus", agentName: "Dwight", text: "Yes, Michael." },
    ],
    ...overrides,
  };
}

function makeLlmResponse(content: string, inputTokens = 100, outputTokens = 50) {
  return {
    content: [{ type: "text", text: content }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("proposition-engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
    );
  });

  // -----------------------------------------------------------------------
  // formatTrajectory
  // -----------------------------------------------------------------------

  describe("formatTrajectory", () => {
    it("formats action entries", () => {
      const entries: TrajectoryEntry[] = [
        { type: "action", agentName: "Michael", text: "That's what she said" },
      ];
      expect(formatTrajectory(entries)).toBe(
        "Michael acts: That's what she said",
      );
    });

    it("formats stimulus entries", () => {
      const entries: TrajectoryEntry[] = [
        { type: "stimulus", agentName: "Dwight", text: "Question." },
      ];
      expect(formatTrajectory(entries)).toBe("--> Dwight: Question.");
    });

    it("formats mixed entries joined by newlines", () => {
      const entries: TrajectoryEntry[] = [
        { type: "action", agentName: "Jim", text: "Looks at camera" },
        { type: "stimulus", agentName: "Pam", text: "Hey Jim" },
        { type: "action", agentName: "Jim", text: "Hey Pam" },
      ];
      const result = formatTrajectory(entries);
      const lines = result.split("\n");
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe("Jim acts: Looks at camera");
      expect(lines[1]).toBe("--> Pam: Hey Jim");
      expect(lines[2]).toBe("Jim acts: Hey Pam");
    });

    it("returns empty string for empty array", () => {
      expect(formatTrajectory([])).toBe("");
    });
  });

  // -----------------------------------------------------------------------
  // SCORING_RUBRIC
  // -----------------------------------------------------------------------

  describe("SCORING_RUBRIC", () => {
    it("contains Score 0 description", () => {
      expect(SCORING_RUBRIC).toContain("Score 0");
    });

    it("contains Score 9 description", () => {
      expect(SCORING_RUBRIC).toContain("Score 9");
    });

    it("contains Scoring principles section", () => {
      expect(SCORING_RUBRIC).toContain("Scoring principles:");
    });

    it("contains all score bands from TinyTroupe rubric", () => {
      expect(SCORING_RUBRIC).toContain("Score 0:");
      expect(SCORING_RUBRIC).toContain("Score 1-2:");
      expect(SCORING_RUBRIC).toContain("Score 3:");
      expect(SCORING_RUBRIC).toContain("Score 4-5:");
      expect(SCORING_RUBRIC).toContain("Score 6:");
      expect(SCORING_RUBRIC).toContain("Score 7-8:");
      expect(SCORING_RUBRIC).toContain("Score 9:");
    });

    it("contains key scoring principles from TinyTroupe", () => {
      expect(SCORING_RUBRIC).toContain("assign score 9");
      expect(SCORING_RUBRIC).toContain("Be VERY rigorous");
      expect(SCORING_RUBRIC).toContain("Contradictions ALWAYS override");
    });
  });

  // -----------------------------------------------------------------------
  // buildJudgeSystemPrompt
  // -----------------------------------------------------------------------

  describe("buildJudgeSystemPrompt", () => {
    it("includes the scoring rubric", () => {
      const prompt = buildJudgeSystemPrompt();
      expect(prompt).toContain(SCORING_RUBRIC);
    });

    it("adds persona section when persona provided", () => {
      const prompt = buildJudgeSystemPrompt("Michael Scott, Regional Manager");
      expect(prompt).toContain(
        "You are evaluating the following character:",
      );
      expect(prompt).toContain("Michael Scott, Regional Manager");
    });

    it("omits persona section when no persona", () => {
      const prompt = buildJudgeSystemPrompt();
      expect(prompt).not.toContain(
        "You are evaluating the following character:",
      );
    });

    it("omits persona section for undefined persona", () => {
      const prompt = buildJudgeSystemPrompt(undefined);
      expect(prompt).not.toContain(
        "You are evaluating the following character:",
      );
    });
  });

  // -----------------------------------------------------------------------
  // buildScoreUserPrompt
  // -----------------------------------------------------------------------

  describe("buildScoreUserPrompt", () => {
    it("includes the claim", () => {
      const prompt = buildScoreUserPrompt(
        { claim: "Agent is empathetic" },
        "some trajectory",
      );
      expect(prompt).toContain("CLAIM: Agent is empathetic");
    });

    it("includes the trajectory", () => {
      const prompt = buildScoreUserPrompt(
        { claim: "test" },
        "Michael acts: Hello",
      );
      expect(prompt).toContain("TRAJECTORY:\nMichael acts: Hello");
    });

    it("includes JSON format instructions with score field", () => {
      const prompt = buildScoreUserPrompt({ claim: "test" }, "trajectory");
      expect(prompt).toContain('"score"');
      expect(prompt).toContain('"reasoning"');
      expect(prompt).toContain('"confidence"');
      expect(prompt).toContain("no markdown");
    });
  });

  // -----------------------------------------------------------------------
  // buildCheckUserPrompt
  // -----------------------------------------------------------------------

  describe("buildCheckUserPrompt", () => {
    it("includes the claim", () => {
      const prompt = buildCheckUserPrompt(
        { claim: "Agent lies" },
        "trajectory",
      );
      expect(prompt).toContain("CLAIM: Agent lies");
    });

    it("includes the trajectory", () => {
      const prompt = buildCheckUserPrompt(
        { claim: "test" },
        "Dwight acts: Bears. Beets.",
      );
      expect(prompt).toContain("Dwight acts: Bears. Beets.");
    });

    it("asks for boolean result in JSON", () => {
      const prompt = buildCheckUserPrompt({ claim: "test" }, "trajectory");
      expect(prompt).toContain('"result"');
      expect(prompt).toContain("true/false");
    });
  });

  // -----------------------------------------------------------------------
  // buildBatchScoreUserPrompt
  // -----------------------------------------------------------------------

  describe("buildBatchScoreUserPrompt", () => {
    it("numbers claims sequentially", () => {
      const prompt = buildBatchScoreUserPrompt(
        [{ claim: "First claim" }, { claim: "Second claim" }],
        "trajectory",
      );
      expect(prompt).toContain("1. First claim");
      expect(prompt).toContain("2. Second claim");
    });

    it("includes trajectory", () => {
      const prompt = buildBatchScoreUserPrompt(
        [{ claim: "test" }],
        "Michael acts: Hey",
      );
      expect(prompt).toContain("TRAJECTORY:\nMichael acts: Hey");
    });

    it("asks for JSON array", () => {
      const prompt = buildBatchScoreUserPrompt(
        [{ claim: "test" }],
        "trajectory",
      );
      expect(prompt).toContain("JSON array");
    });
  });

  // -----------------------------------------------------------------------
  // parseScoreResponse
  // -----------------------------------------------------------------------

  describe("parseScoreResponse", () => {
    it("parses valid JSON", () => {
      const result = parseScoreResponse(
        '{"score": 7, "reasoning": "Good behavior", "confidence": 0.9}',
      );
      expect(result.score).toBe(7);
      expect(result.reasoning).toBe("Good behavior");
      expect(result.confidence).toBe(0.9);
    });

    it("clamps score above 9 to 9", () => {
      const result = parseScoreResponse(
        '{"score": 15, "reasoning": "test", "confidence": 0.8}',
      );
      expect(result.score).toBe(9);
    });

    it("clamps score below 0 to 0", () => {
      const result = parseScoreResponse(
        '{"score": -3, "reasoning": "test", "confidence": 0.5}',
      );
      expect(result.score).toBe(0);
    });

    it("rounds float scores to integer", () => {
      const result = parseScoreResponse(
        '{"score": 6.7, "reasoning": "test", "confidence": 0.5}',
      );
      expect(result.score).toBe(7);
    });

    it("rounds down float scores below .5", () => {
      const result = parseScoreResponse(
        '{"score": 6.3, "reasoning": "test", "confidence": 0.5}',
      );
      expect(result.score).toBe(6);
    });

    it("clamps confidence above 1 to 1", () => {
      const result = parseScoreResponse(
        '{"score": 5, "reasoning": "test", "confidence": 1.5}',
      );
      expect(result.confidence).toBe(1);
    });

    it("clamps confidence below 0 to 0", () => {
      const result = parseScoreResponse(
        '{"score": 5, "reasoning": "test", "confidence": -0.3}',
      );
      expect(result.confidence).toBe(0);
    });

    it("defaults confidence to 0.5 when missing", () => {
      const result = parseScoreResponse(
        '{"score": 5, "reasoning": "test"}',
      );
      expect(result.confidence).toBe(0.5);
    });

    it("extracts JSON from surrounding text", () => {
      const restore = silenceConsole();
      const wrapped =
        'Here is my evaluation:\n{"score": 8, "reasoning": "well done", "confidence": 0.85}\nThat is all.';
      const result = parseScoreResponse(wrapped);
      expect(result.score).toBe(8);
      expect(result.reasoning).toBe("well done");
      expect(result.confidence).toBe(0.85);
      restore();
    });

    it("throws on completely invalid input", () => {
      const restore = silenceConsole();
      expect(() => parseScoreResponse("this is not json at all")).toThrow(
        "Failed to parse score response",
      );
      restore();
    });

    it("throws when score field is missing", () => {
      const restore = silenceConsole();
      expect(() =>
        parseScoreResponse('{"reasoning": "no score here"}'),
      ).toThrow("Invalid score response structure");
      restore();
    });
  });

  // -----------------------------------------------------------------------
  // parseCheckResponse
  // -----------------------------------------------------------------------

  describe("parseCheckResponse", () => {
    it("parses valid true response", () => {
      const result = parseCheckResponse(
        '{"result": true, "reasoning": "Confirmed", "confidence": 0.95}',
      );
      expect(result.result).toBe(true);
      expect(result.reasoning).toBe("Confirmed");
      expect(result.confidence).toBe(0.95);
    });

    it("parses valid false response", () => {
      const result = parseCheckResponse(
        '{"result": false, "reasoning": "Not observed", "confidence": 0.7}',
      );
      expect(result.result).toBe(false);
    });

    it("coerces truthy values to boolean true", () => {
      const result = parseCheckResponse(
        '{"result": 1, "reasoning": "test", "confidence": 0.5}',
      );
      expect(result.result).toBe(true);
    });

    it("coerces falsy values to boolean false", () => {
      const result = parseCheckResponse(
        '{"result": 0, "reasoning": "test", "confidence": 0.5}',
      );
      expect(result.result).toBe(false);
    });

    it("coerces null to boolean false", () => {
      const result = parseCheckResponse(
        '{"result": null, "reasoning": "test", "confidence": 0.5}',
      );
      expect(result.result).toBe(false);
    });

    it("defaults confidence to 0.5 when missing", () => {
      const result = parseCheckResponse(
        '{"result": true, "reasoning": "test"}',
      );
      expect(result.confidence).toBe(0.5);
    });

    it("extracts JSON from surrounding text", () => {
      const restore = silenceConsole();
      const wrapped =
        'My analysis:\n{"result": false, "reasoning": "nope", "confidence": 0.6}\nDone.';
      const result = parseCheckResponse(wrapped);
      expect(result.result).toBe(false);
      expect(result.reasoning).toBe("nope");
      restore();
    });

    it("throws on completely invalid input", () => {
      const restore = silenceConsole();
      expect(() => parseCheckResponse("nonsense")).toThrow(
        "Failed to parse check response",
      );
      restore();
    });
  });

  // -----------------------------------------------------------------------
  // parseBatchScoreResponse
  // -----------------------------------------------------------------------

  describe("parseBatchScoreResponse", () => {
    it("parses valid JSON array", () => {
      const raw = JSON.stringify([
        { score: 7, reasoning: "good", confidence: 0.9 },
        { score: 3, reasoning: "weak", confidence: 0.6 },
      ]);
      const results = parseBatchScoreResponse(raw, 2);
      expect(results).toHaveLength(2);
      expect(results.at(0)?.score).toBe(7);
      expect(results.at(1)?.score).toBe(3);
    });

    it("throws on count mismatch", () => {
      const restore = silenceConsole();
      const raw = JSON.stringify([
        { score: 7, reasoning: "good", confidence: 0.9 },
      ]);
      expect(() => parseBatchScoreResponse(raw, 2)).toThrow(
        "count mismatch",
      );
      restore();
    });

    it("applies clamping and rounding to each entry", () => {
      const raw = JSON.stringify([
        { score: 10.5, reasoning: "clamped", confidence: 1.5 },
        { score: -2, reasoning: "clamped low", confidence: -0.1 },
      ]);
      const results = parseBatchScoreResponse(raw, 2);
      expect(results.at(0)?.score).toBe(9);
      expect(results.at(0)?.confidence).toBe(1);
      expect(results.at(1)?.score).toBe(0);
      expect(results.at(1)?.confidence).toBe(0);
    });

    it("defaults confidence to 0.5 when missing in array entries", () => {
      const raw = JSON.stringify([{ score: 5, reasoning: "ok" }]);
      const results = parseBatchScoreResponse(raw, 1);
      expect(results.at(0)?.confidence).toBe(0.5);
    });

    it("throws when response is not an array", () => {
      const restore = silenceConsole();
      expect(() =>
        parseBatchScoreResponse('{"score": 5}', 1),
      ).toThrow("not an array");
      restore();
    });
  });

  // -----------------------------------------------------------------------
  // scoreProposition (LLM-backed)
  // -----------------------------------------------------------------------

  describe("scoreProposition", () => {
    it("calls the API with correct model and returns parsed result", async () => {
      mockMessagesCreate.mockResolvedValueOnce(
        makeLlmResponse(
          '{"score": 7, "reasoning": "Good", "confidence": 0.85}',
        ),
      );

      const result = await scoreProposition(
        makeProposition(),
        makeContext(),
      );

      expect(result.score).toBe(7);
      expect(result.reasoning).toBe("Good");
      expect(result.confidence).toBe(0.85);
      expect(result.tokenUsage.input_tokens).toBe(100);
      expect(result.tokenUsage.output_tokens).toBe(50);

      expect(mockMessagesCreate).toHaveBeenCalledOnce();
      const callArgs = mockMessagesCreate.mock.calls.at(0)?.at(0) as Record<string, unknown>;
      expect(callArgs.model).toBe("claude-haiku-4-5-20251001");
      expect(callArgs.max_tokens).toBe(1024);
      expect(callArgs.temperature).toBe(0);
    });

    it("includes persona in system prompt when provided", async () => {
      mockMessagesCreate.mockResolvedValueOnce(
        makeLlmResponse('{"score": 6, "reasoning": "ok", "confidence": 0.7}'),
      );

      await scoreProposition(
        makeProposition(),
        makeContext({ persona: "Regional Manager of Dunder Mifflin" }),
      );

      const callArgs = mockMessagesCreate.mock.calls.at(0)?.at(0) as Record<string, unknown>;
      expect(callArgs.system).toContain("Regional Manager of Dunder Mifflin");
    });

    it("returns token usage from LLM response", async () => {
      mockMessagesCreate.mockResolvedValueOnce(
        makeLlmResponse(
          '{"score": 5, "reasoning": "ok", "confidence": 0.5}',
          200,
          80,
        ),
      );

      const result = await scoreProposition(
        makeProposition(),
        makeContext(),
      );

      expect(result.tokenUsage.input_tokens).toBe(200);
      expect(result.tokenUsage.output_tokens).toBe(80);
    });
  });

  // -----------------------------------------------------------------------
  // checkProposition (LLM-backed)
  // -----------------------------------------------------------------------

  describe("checkProposition", () => {
    it("returns boolean result from LLM", async () => {
      mockMessagesCreate.mockResolvedValueOnce(
        makeLlmResponse(
          '{"result": true, "reasoning": "Confirmed", "confidence": 0.9}',
        ),
      );

      const result = await checkProposition(
        makeProposition(),
        makeContext(),
      );

      expect(result.result).toBe(true);
      expect(result.reasoning).toBe("Confirmed");
      expect(result.confidence).toBe(0.9);
      expect(result.tokenUsage.input_tokens).toBe(100);
      expect(result.tokenUsage.output_tokens).toBe(50);
    });

    it("returns false result when LLM says false", async () => {
      mockMessagesCreate.mockResolvedValueOnce(
        makeLlmResponse(
          '{"result": false, "reasoning": "Not observed", "confidence": 0.8}',
        ),
      );

      const result = await checkProposition(
        makeProposition(),
        makeContext(),
      );

      expect(result.result).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // scorePropositions (batch)
  // -----------------------------------------------------------------------

  describe("scorePropositions", () => {
    it("makes one API call for batch of 10 or fewer", async () => {
      const props = Array.from({ length: 5 }, (_, i) =>
        makeProposition({ id: `prop-${i}`, claim: `Claim ${i}` }),
      );
      const batchResponse = JSON.stringify(
        Array.from({ length: 5 }, (_, i) => ({
          score: i + 3,
          reasoning: `reason-${i}`,
          confidence: 0.8,
        })),
      );
      mockMessagesCreate.mockResolvedValueOnce(
        makeLlmResponse(batchResponse),
      );

      const result = await scorePropositions(props, makeContext());

      expect(mockMessagesCreate).toHaveBeenCalledOnce();
      expect(result.results).toHaveLength(5);
      expect(result.results.at(0)?.score).toBe(3);
      expect(result.results.at(4)?.score).toBe(7);
    });

    it("splits into multiple batches when more than 10 propositions", async () => {
      const props = Array.from({ length: 12 }, (_, i) =>
        makeProposition({ id: `prop-${i}`, claim: `Claim ${i}` }),
      );

      const batch1Response = JSON.stringify(
        Array.from({ length: 10 }, () => ({
          score: 7,
          reasoning: "batch1",
          confidence: 0.8,
        })),
      );
      const batch2Response = JSON.stringify(
        Array.from({ length: 2 }, () => ({
          score: 5,
          reasoning: "batch2",
          confidence: 0.6,
        })),
      );

      mockMessagesCreate
        .mockResolvedValueOnce(makeLlmResponse(batch1Response, 500, 200))
        .mockResolvedValueOnce(makeLlmResponse(batch2Response, 150, 60));

      const result = await scorePropositions(props, makeContext());

      expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
      expect(result.results).toHaveLength(12);
      expect(result.results.at(0)?.score).toBe(7);
      expect(result.results.at(11)?.score).toBe(5);
    });

    it("aggregates token usage across batches", async () => {
      const props = Array.from({ length: 12 }, (_, i) =>
        makeProposition({ id: `prop-${i}`, claim: `Claim ${i}` }),
      );

      mockMessagesCreate
        .mockResolvedValueOnce(
          makeLlmResponse(
            JSON.stringify(
              Array.from({ length: 10 }, () => ({
                score: 5,
                reasoning: "r",
                confidence: 0.5,
              })),
            ),
            400,
            100,
          ),
        )
        .mockResolvedValueOnce(
          makeLlmResponse(
            JSON.stringify(
              Array.from({ length: 2 }, () => ({
                score: 5,
                reasoning: "r",
                confidence: 0.5,
              })),
            ),
            80,
            20,
          ),
        );

      const result = await scorePropositions(props, makeContext());

      expect(result.tokenUsage.input_tokens).toBe(480);
      expect(result.tokenUsage.output_tokens).toBe(120);
    });
  });

  // -----------------------------------------------------------------------
  // Double-check
  // -----------------------------------------------------------------------

  describe("double-check", () => {
    it("makes two LLM calls when doubleCheck is true", async () => {
      mockMessagesCreate
        .mockResolvedValueOnce(
          makeLlmResponse(
            '{"score": 6, "reasoning": "initial", "confidence": 0.7}',
            100,
            50,
          ),
        )
        .mockResolvedValueOnce(
          makeLlmResponse(
            '{"score": 7, "reasoning": "revised", "confidence": 0.85}',
            150,
            60,
          ),
        );

      const result = await scoreProposition(
        makeProposition(),
        makeContext(),
        { doubleCheck: true },
      );

      expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
      expect(result.score).toBe(7);
      expect(result.reasoning).toBe("revised");
    });

    it("includes 'Are you sure?' in the second call messages", async () => {
      mockMessagesCreate
        .mockResolvedValueOnce(
          makeLlmResponse(
            '{"score": 6, "reasoning": "initial", "confidence": 0.7}',
          ),
        )
        .mockResolvedValueOnce(
          makeLlmResponse(
            '{"score": 7, "reasoning": "revised", "confidence": 0.85}',
          ),
        );

      await scoreProposition(
        makeProposition(),
        makeContext(),
        { doubleCheck: true },
      );

      const secondCallArgs = mockMessagesCreate.mock.calls.at(1)?.at(0) as Record<
        string,
        unknown
      >;
      const messages = secondCallArgs.messages as {
        role: string;
        content: string;
      }[];
      const revisionMessage = messages.find((m) =>
        m.content.includes("Are you sure?"),
      );
      expect(revisionMessage).toBeDefined();
    });

    it("aggregates token usage from both calls", async () => {
      mockMessagesCreate
        .mockResolvedValueOnce(
          makeLlmResponse(
            '{"score": 6, "reasoning": "initial", "confidence": 0.7}',
            100,
            50,
          ),
        )
        .mockResolvedValueOnce(
          makeLlmResponse(
            '{"score": 7, "reasoning": "revised", "confidence": 0.85}',
            150,
            60,
          ),
        );

      const result = await scoreProposition(
        makeProposition(),
        makeContext(),
        { doubleCheck: true },
      );

      expect(result.tokenUsage.input_tokens).toBe(250);
      expect(result.tokenUsage.output_tokens).toBe(110);
    });

    it("is skipped by default", async () => {
      mockMessagesCreate.mockResolvedValueOnce(
        makeLlmResponse(
          '{"score": 6, "reasoning": "only one call", "confidence": 0.7}',
        ),
      );

      const result = await scoreProposition(
        makeProposition(),
        makeContext(),
      );

      expect(mockMessagesCreate).toHaveBeenCalledOnce();
      expect(result.score).toBe(6);
    });
  });

  // -----------------------------------------------------------------------
  // Precondition gating
  // -----------------------------------------------------------------------

  describe("precondition gating", () => {
    it("returns score 9 without LLM call when precondition returns false", async () => {
      const prop = makeProposition({
        precondition: () => false,
      });

      const result = await scoreProposition(prop, makeContext());

      expect(mockMessagesCreate).not.toHaveBeenCalled();
      expect(result.score).toBe(9);
      expect(result.confidence).toBe(1);
      expect(result.reasoning).toBe(
        "precondition not met (trivially true)",
      );
      expect(result.tokenUsage.input_tokens).toBe(0);
      expect(result.tokenUsage.output_tokens).toBe(0);
    });

    it("proceeds with LLM call when precondition returns true", async () => {
      mockMessagesCreate.mockResolvedValueOnce(
        makeLlmResponse(
          '{"score": 4, "reasoning": "evaluated", "confidence": 0.6}',
        ),
      );

      const prop = makeProposition({
        precondition: () => true,
      });

      const result = await scoreProposition(prop, makeContext());

      expect(mockMessagesCreate).toHaveBeenCalledOnce();
      expect(result.score).toBe(4);
    });

    it("proceeds with LLM call when precondition is undefined", async () => {
      mockMessagesCreate.mockResolvedValueOnce(
        makeLlmResponse(
          '{"score": 5, "reasoning": "no precondition", "confidence": 0.5}',
        ),
      );

      const result = await scoreProposition(
        makeProposition(),
        makeContext(),
      );

      expect(mockMessagesCreate).toHaveBeenCalledOnce();
      expect(result.score).toBe(5);
    });

    it("returns true for check when precondition returns false", async () => {
      const prop = makeProposition({
        precondition: () => false,
      });

      const result = await checkProposition(prop, makeContext());

      expect(mockMessagesCreate).not.toHaveBeenCalled();
      expect(result.result).toBe(true);
      expect(result.confidence).toBe(1);
      expect(result.reasoning).toBe(
        "precondition not met (trivially true)",
      );
      expect(result.tokenUsage.input_tokens).toBe(0);
    });

    it("proceeds with LLM for check when precondition is true", async () => {
      mockMessagesCreate.mockResolvedValueOnce(
        makeLlmResponse(
          '{"result": false, "reasoning": "checked", "confidence": 0.8}',
        ),
      );

      const prop = makeProposition({
        precondition: () => true,
      });

      const result = await checkProposition(prop, makeContext());

      expect(mockMessagesCreate).toHaveBeenCalledOnce();
      expect(result.result).toBe(false);
    });
  });
});
