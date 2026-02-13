import { describe, it, expect } from "vitest";
import {
  tokenize,
  computeVocabularyStats,
  computePairwiseSimilarity,
} from "../text-stats";

describe("text-stats utilities", () => {
  describe("tokenize", () => {
    it("lowercases and splits on whitespace", () => {
      expect(tokenize("Hello World")).toEqual(["hello", "world"]);
    });

    it("strips punctuation", () => {
      expect(tokenize("Hello, world! How's it going?")).toEqual([
        "hello",
        "world",
        "hows",
        "it",
        "going",
      ]);
    });

    it("returns empty array for empty string", () => {
      expect(tokenize("")).toEqual([]);
    });

    it("handles multiple spaces", () => {
      expect(tokenize("hello   world")).toEqual(["hello", "world"]);
    });

    it("handles only punctuation", () => {
      expect(tokenize("!@#$%")).toEqual([]);
    });
  });

  describe("computeVocabularyStats", () => {
    it("returns zeros for empty messages", () => {
      const result = computeVocabularyStats([]);
      expect(result.uniqueWordRatio).toBe(0);
      expect(result.avgSentenceLength).toBe(0);
      expect(result.punctuationDensity).toBe(0);
    });

    it("computes uniqueWordRatio correctly", () => {
      // "the cat the dog" → 4 tokens, 3 unique → 0.75
      const result = computeVocabularyStats(["the cat the dog"]);
      expect(result.uniqueWordRatio).toBeCloseTo(0.75);
    });

    it("computes uniqueWordRatio of 1.0 for all unique words", () => {
      const result = computeVocabularyStats(["alpha beta gamma delta"]);
      expect(result.uniqueWordRatio).toBe(1.0);
    });

    it("computes avgSentenceLength across sentences", () => {
      // "Hello world. Goodbye." → 2 sentences, 3 words → avg 1.5
      const result = computeVocabularyStats(["Hello world. Goodbye."]);
      expect(result.avgSentenceLength).toBeCloseTo(1.5);
    });

    it("computes punctuationDensity", () => {
      // "hi!" → 3 chars total, 1 punctuation char → 1/3
      const result = computeVocabularyStats(["hi!"]);
      expect(result.punctuationDensity).toBeCloseTo(1 / 3);
    });

    it("handles multiple messages", () => {
      const result = computeVocabularyStats([
        "the quick brown fox",
        "the lazy brown dog",
      ]);
      // 8 tokens, 6 unique → 0.75
      expect(result.uniqueWordRatio).toBeCloseTo(0.75);
    });
  });

  describe("computePairwiseSimilarity", () => {
    it("returns empty map for single agent", () => {
      const agentMessages = new Map([["alice", ["hello world"]]]);
      const result = computePairwiseSimilarity(agentMessages);
      expect(result.size).toBe(0);
    });

    it("returns 1.0 for identical corpora", () => {
      const agentMessages = new Map([
        ["alice", ["hello world"]],
        ["bob", ["hello world"]],
      ]);
      const result = computePairwiseSimilarity(agentMessages);
      expect(result.get("alice-bob")).toBe(1.0);
    });

    it("returns 0 for completely different corpora", () => {
      const agentMessages = new Map([
        ["alice", ["alpha beta gamma"]],
        ["bob", ["one two three"]],
      ]);
      const result = computePairwiseSimilarity(agentMessages);
      expect(result.get("alice-bob")).toBe(0);
    });

    it("computes Jaccard similarity correctly for partial overlap", () => {
      const agentMessages = new Map([
        ["alice", ["hello world foo"]],
        ["bob", ["hello world bar"]],
      ]);
      const result = computePairwiseSimilarity(agentMessages);
      // alice: {hello, world, foo}, bob: {hello, world, bar}
      // intersection = 2, union = 4 → 0.5
      expect(result.get("alice-bob")).toBeCloseTo(0.5);
    });

    it("sorts agent IDs alphabetically in keys", () => {
      const agentMessages = new Map([
        ["zara", ["hello"]],
        ["alice", ["hello"]],
      ]);
      const result = computePairwiseSimilarity(agentMessages);
      expect(result.has("alice-zara")).toBe(true);
      expect(result.has("zara-alice")).toBe(false);
    });

    it("computes all pairs for 3 agents", () => {
      const agentMessages = new Map([
        ["alice", ["alpha"]],
        ["bob", ["beta"]],
        ["charlie", ["gamma"]],
      ]);
      const result = computePairwiseSimilarity(agentMessages);
      expect(result.size).toBe(3);
      expect(result.has("alice-bob")).toBe(true);
      expect(result.has("alice-charlie")).toBe(true);
      expect(result.has("bob-charlie")).toBe(true);
    });

    it("returns 0 for empty corpora", () => {
      const agentMessages = new Map([
        ["alice", [""]],
        ["bob", [""]],
      ]);
      const result = computePairwiseSimilarity(agentMessages);
      expect(result.get("alice-bob")).toBe(0);
    });
  });
});
