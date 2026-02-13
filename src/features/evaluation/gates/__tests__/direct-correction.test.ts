import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStartSpan = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();

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
    count: vi.fn(),
    distribution: vi.fn(),
  },
}));

mockStartSpan.mockImplementation(
  (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
);

// Mock Anthropic client via @/lib/anthropic (same pattern as proposition-engine)
const mockCreate = vi.fn();
vi.mock("@/lib/anthropic", () => ({
  getAnthropicClient: () => ({ messages: { create: mockCreate } }),
  JUDGE_MODEL: "claude-haiku-4-5-20251001",
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { directCorrect } from "../direct-correction";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("directCorrect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
    );
  });

  it("calls LLM and parses JSON structured output", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ corrected_text: "Corrected message here" }) }],
      usage: { input_tokens: 200, output_tokens: 50 },
    });

    const result = await directCorrect(
      "Bad original message",
      [{
        dimension: "persona_adherence" as const,
        score: 3,
        threshold: 7,
        reasoning: "Out of character",
        recommendation: "Write in Michael Scott's voice",
      }],
      { agentName: "Michael Scott", persona: "You are Michael Scott..." },
    );

    expect(result.correctedText).toBe("Corrected message here");
    expect(result.tokenUsage.input_tokens).toBe(200);
    expect(result.tokenUsage.output_tokens).toBe(50);
    expect(mockCreate).toHaveBeenCalledOnce();

    // Verify output_config with json_schema was used
    const callArgs = mockCreate.mock.calls[0] as unknown[];
    const body = callArgs[0] as Record<string, unknown>;
    expect(body).toHaveProperty("output_config");
  });

  it("includes persona and conversation context in prompt", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ corrected_text: "Fixed" }) }],
      usage: { input_tokens: 100, output_tokens: 20 },
    });

    await directCorrect(
      "Bad message",
      [{
        dimension: "fluency" as const,
        score: 2,
        threshold: 7,
        reasoning: "Repetitive",
        recommendation: "Vary language",
      }],
      {
        agentName: "Michael",
        persona: "Michael persona",
        conversationContext: ["Hey Michael", "What's up?"],
      },
    );

    const callArgs = mockCreate.mock.calls[0] as unknown[];
    const body = callArgs[0] as { messages: { content: string }[] };
    const content = body.messages[0]?.content ?? "";
    expect(content).toContain("Michael persona");
    expect(content).toContain("Hey Michael");
    expect(content).toContain("fluency");
  });

  it("returns original text on timeout/error (fail-open)", async () => {
    mockCreate.mockRejectedValue(new Error("Request timed out"));

    const result = await directCorrect(
      "Original text preserved",
      [{
        dimension: "persona_adherence" as const,
        score: 3,
        threshold: 7,
        reasoning: "Bad",
        recommendation: "Fix it",
      }],
      { agentName: "Michael" },
    );

    expect(result.correctedText).toBe("Original text preserved");
    expect(result.tokenUsage.input_tokens).toBe(0);
  });

  it("handles multiple failed dimensions", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ corrected_text: "Multi-fixed" }) }],
      usage: { input_tokens: 300, output_tokens: 60 },
    });

    const result = await directCorrect(
      "Bad text",
      [
        { dimension: "persona_adherence" as const, score: 3, threshold: 7, reasoning: "OOC", recommendation: "Be Michael" },
        { dimension: "fluency" as const, score: 4, threshold: 7, reasoning: "Repetitive", recommendation: "Vary" },
      ],
      { agentName: "Michael" },
    );

    expect(result.correctedText).toBe("Multi-fixed");
    const callArgs = mockCreate.mock.calls[0] as unknown[];
    const body = callArgs[0] as { messages: { content: string }[] };
    const content = body.messages[0]?.content ?? "";
    expect(content).toContain("persona_adherence");
    expect(content).toContain("fluency");
  });

  it("handles empty response content gracefully", async () => {
    mockCreate.mockResolvedValue({
      content: [],
      usage: { input_tokens: 100, output_tokens: 0 },
    });

    const result = await directCorrect(
      "Original fallback",
      [{ dimension: "fluency" as const, score: 3, threshold: 7, reasoning: "Bad", recommendation: "Fix" }],
      { agentName: "Michael" },
    );

    expect(result.correctedText).toBe("Original fallback");
  });

  it("falls back to raw text when JSON parsing fails", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Just plain corrected text" }],
      usage: { input_tokens: 150, output_tokens: 30 },
    });

    const result = await directCorrect(
      "Original message",
      [{ dimension: "fluency" as const, score: 3, threshold: 7, reasoning: "Bad", recommendation: "Fix" }],
      { agentName: "Michael" },
    );

    expect(result.correctedText).toBe("Just plain corrected text");
  });

  it("uses JUDGE_MODEL from @/lib/anthropic", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ corrected_text: "Fixed" }) }],
      usage: { input_tokens: 100, output_tokens: 20 },
    });

    await directCorrect(
      "Test",
      [{ dimension: "fluency" as const, score: 3, threshold: 7, reasoning: "Bad", recommendation: "Fix" }],
      { agentName: "Michael" },
    );

    const callArgs = mockCreate.mock.calls[0] as unknown[];
    const body = callArgs[0] as { model: string };
    expect(body.model).toBe("claude-haiku-4-5-20251001");
  });
});
