import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockComputeCorpusRepetition = vi.fn<(messages: string[], n: number) => number>();
const mockExtractNgrams = vi.fn<(text: string, n: number) => Set<string>>();

vi.mock("@/features/evaluation/utils/ngram", () => ({
  computeCorpusRepetition: (...args: unknown[]): number =>
    mockComputeCorpusRepetition(args[0] as string[], args[1] as number),
  extractNgrams: (...args: unknown[]): Set<string> =>
    mockExtractNgrams(args[0] as string, args[1] as number),
}));

const mockGetRecentAgentMessages = vi.fn();

vi.mock("@/db/queries", () => ({
  getRecentAgentMessages: (...args: unknown[]): unknown =>
    mockGetRecentAgentMessages(...args),
}));

vi.mock("@/lib/telemetry", () => ({
  withSpan: vi.fn((_name: string, _op: string, fn: () => unknown) => fn()),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  countMetric: vi.fn(),
  distributionMetric: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  detectRepetition,
  findRepeatedNgrams,
  buildRepetitionContext,
  checkRepetitionSuppression,
} from "../repetition-suppression";

import { countMetric, logInfo } from "@/lib/telemetry";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("repetition-suppression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- detectRepetition ---

  it("returns detected=true when overlap >= threshold", () => {
    mockComputeCorpusRepetition.mockReturnValue(0.5);
    const result = detectRepetition(["msg1", "msg2"]);
    expect(result.detected).toBe(true);
    expect(result.overlapScore).toBe(0.5);
  });

  it("returns detected=false when overlap < threshold", () => {
    mockComputeCorpusRepetition.mockReturnValue(0.1);
    const result = detectRepetition(["msg1", "msg2"]);
    expect(result.detected).toBe(false);
    expect(result.overlapScore).toBe(0.1);
  });

  it("uses custom threshold when provided", () => {
    mockComputeCorpusRepetition.mockReturnValue(0.5);
    const result = detectRepetition(["msg1", "msg2"], 0.6);
    expect(result.detected).toBe(false);
    expect(result.overlapScore).toBe(0.5);
  });

  it("handles single message (computeCorpusRepetition returns 0)", () => {
    mockComputeCorpusRepetition.mockReturnValue(0);
    const result = detectRepetition(["msg1"]);
    expect(result.detected).toBe(false);
    expect(result.overlapScore).toBe(0);
  });

  // --- findRepeatedNgrams ---

  it("returns n-grams appearing in 2+ messages", () => {
    // "hello world foo" and "hello world bar" share "hello world"
    mockExtractNgrams
      .mockReturnValueOnce(new Set(["hello world foo", "world foo bar"]))
      .mockReturnValueOnce(new Set(["hello world foo", "world foo baz"]));

    const result = findRepeatedNgrams(["msg1", "msg2"]);
    expect(result).toContain("hello world foo");
    expect(result).not.toContain("world foo bar");
    expect(result).not.toContain("world foo baz");
  });

  it("returns empty array when no n-grams repeat", () => {
    mockExtractNgrams
      .mockReturnValueOnce(new Set(["aaa bbb ccc"]))
      .mockReturnValueOnce(new Set(["ddd eee fff"]));

    const result = findRepeatedNgrams(["msg1", "msg2"]);
    expect(result).toEqual([]);
  });

  it("sorts by frequency descending", () => {
    // ngram "common phrase" appears in all 3, "semi common" in 2
    mockExtractNgrams
      .mockReturnValueOnce(new Set(["common phrase", "semi common", "unique one"]))
      .mockReturnValueOnce(new Set(["common phrase", "semi common", "unique two"]))
      .mockReturnValueOnce(new Set(["common phrase", "unique three"]));

    const result = findRepeatedNgrams(["msg1", "msg2", "msg3"]);
    expect(result[0]).toBe("common phrase");
    expect(result[1]).toBe("semi common");
    expect(result).toHaveLength(2);
  });

  // --- buildRepetitionContext ---

  it("includes all messages numbered", () => {
    const result = buildRepetitionContext(
      ["Hello there", "How are you", "Good morning"],
      ["hello there"],
    );
    expect(result).toContain('1. "Hello there"');
    expect(result).toContain('2. "How are you"');
    expect(result).toContain('3. "Good morning"');
  });

  it("includes IMPORTANT instruction with repeated n-grams", () => {
    const result = buildRepetitionContext(
      ["test message"],
      ["repeated phrase", "another phrase"],
    );
    expect(result).toContain("IMPORTANT");
    expect(result).toContain('"repeated phrase"');
    expect(result).toContain('"another phrase"');
    expect(result).toContain("Vary your language");
  });

  it("limits to 10 n-grams max", () => {
    const ngrams = Array.from({ length: 15 }, (_, i) => `ngram ${i}`);
    const result = buildRepetitionContext(["test"], ngrams);

    // Should have first 10 but not last 5
    expect(result).toContain('"ngram 0"');
    expect(result).toContain('"ngram 9"');
    expect(result).not.toContain('"ngram 10"');
    expect(result).not.toContain('"ngram 14"');
  });

  // --- checkRepetitionSuppression ---

  it("returns null context when < 2 messages", async () => {
    mockGetRecentAgentMessages.mockResolvedValue([
      { text: "only one", userId: "michael", createdAt: new Date() },
    ]);

    const result = await checkRepetitionSuppression("michael");
    expect(result.detected).toBe(false);
    expect(result.context).toBeNull();
    expect(result.repeatedNgrams).toEqual([]);
    expect(logInfo).toHaveBeenCalledWith(
      "repetitionSuppression.skipped",
      expect.objectContaining({ agentId: "michael", reason: "insufficient_messages" }),
    );
  });

  it("returns context when repetition detected", async () => {
    mockGetRecentAgentMessages.mockResolvedValue([
      { text: "I love paper sales", userId: "michael", createdAt: new Date() },
      { text: "I love paper and sales", userId: "michael", createdAt: new Date() },
    ]);
    mockComputeCorpusRepetition.mockReturnValue(0.5);
    mockExtractNgrams
      .mockReturnValueOnce(new Set(["i love paper"]))
      .mockReturnValueOnce(new Set(["i love paper"]));

    const result = await checkRepetitionSuppression("michael");
    expect(result.detected).toBe(true);
    expect(result.context).toBeTruthy();
    expect(result.context).toContain("IMPORTANT");
    expect(result.repeatedNgrams).toContain("i love paper");
  });

  it("returns null context when no repetition detected", async () => {
    mockGetRecentAgentMessages.mockResolvedValue([
      { text: "Hello there friend", userId: "michael", createdAt: new Date() },
      { text: "Completely different topic", userId: "michael", createdAt: new Date() },
    ]);
    mockComputeCorpusRepetition.mockReturnValue(0.1);

    const result = await checkRepetitionSuppression("michael");
    expect(result.detected).toBe(false);
    expect(result.context).toBeNull();
    expect(result.repeatedNgrams).toEqual([]);
  });

  it("emits telemetry metrics", async () => {
    mockGetRecentAgentMessages.mockResolvedValue([
      { text: "Hey there", userId: "michael", createdAt: new Date() },
      { text: "Hey everyone", userId: "michael", createdAt: new Date() },
    ]);
    mockComputeCorpusRepetition.mockReturnValue(0.4);
    mockExtractNgrams
      .mockReturnValueOnce(new Set(["hey there friend"]))
      .mockReturnValueOnce(new Set(["hey everyone now"]));

    await checkRepetitionSuppression("michael");

    expect(countMetric).toHaveBeenCalledWith(
      "repetitionSuppression.checked",
      1,
      expect.objectContaining({ agentId: "michael", detected: "true" }),
    );
    expect(logInfo).toHaveBeenCalledWith(
      "repetitionSuppression.result",
      expect.objectContaining({
        agentId: "michael",
        detected: true,
      }),
    );
  });
});
