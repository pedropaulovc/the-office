import { describe, it, expect } from "vitest";
import {
  extractNgrams,
  computeOverlap,
  computeCorpusRepetition,
} from "../ngram";

describe("ngram utilities", () => {
  describe("extractNgrams", () => {
    it("extracts bigrams from a simple sentence", () => {
      const result = extractNgrams("hello world foo", 2);
      expect(result).toEqual(new Set(["hello world", "world foo"]));
    });

    it("extracts trigrams from a sentence", () => {
      const result = extractNgrams("the quick brown fox", 3);
      expect(result).toEqual(
        new Set(["the quick brown", "quick brown fox"]),
      );
    });

    it("lowercases text", () => {
      const result = extractNgrams("Hello World Foo", 2);
      expect(result.has("hello world")).toBe(true);
    });

    it("strips punctuation", () => {
      const result = extractNgrams("hello, world! foo.", 2);
      expect(result).toEqual(new Set(["hello world", "world foo"]));
    });

    it("returns empty set when text has fewer tokens than n", () => {
      const result = extractNgrams("hello", 3);
      expect(result.size).toBe(0);
    });

    it("returns empty set for empty string", () => {
      const result = extractNgrams("", 2);
      expect(result.size).toBe(0);
    });

    it("handles single token with n=1", () => {
      const result = extractNgrams("hello", 1);
      expect(result).toEqual(new Set(["hello"]));
    });

    it("deduplicates repeated n-grams", () => {
      const result = extractNgrams("the the the", 2);
      expect(result).toEqual(new Set(["the the"]));
    });
  });

  describe("computeOverlap", () => {
    it("returns 1.0 for identical sets", () => {
      const a = new Set(["hello world", "world foo"]);
      const b = new Set(["hello world", "world foo"]);
      expect(computeOverlap(a, b)).toBe(1);
    });

    it("returns 0 for disjoint sets", () => {
      const a = new Set(["hello world"]);
      const b = new Set(["foo bar"]);
      expect(computeOverlap(a, b)).toBe(0);
    });

    it("returns 0 for two empty sets", () => {
      expect(computeOverlap(new Set(), new Set())).toBe(0);
    });

    it("returns 0 when one set is empty", () => {
      const a = new Set(["hello world"]);
      expect(computeOverlap(a, new Set())).toBe(0);
    });

    it("computes Jaccard correctly for partial overlap", () => {
      const a = new Set(["a b", "b c", "c d"]);
      const b = new Set(["a b", "c d", "d e"]);
      // intersection: {a b, c d} = 2, union: {a b, b c, c d, d e} = 4
      expect(computeOverlap(a, b)).toBeCloseTo(0.5);
    });
  });

  describe("computeCorpusRepetition", () => {
    it("returns 0 for fewer than 2 messages", () => {
      expect(computeCorpusRepetition([], 3)).toBe(0);
      expect(computeCorpusRepetition(["hello world foo"], 3)).toBe(0);
    });

    it("returns 1.0 for identical messages", () => {
      const messages = [
        "the quick brown fox jumps",
        "the quick brown fox jumps",
      ];
      expect(computeCorpusRepetition(messages, 3)).toBe(1);
    });

    it("returns 0 for completely different messages", () => {
      const messages = [
        "alpha beta gamma delta",
        "one two three four",
      ];
      expect(computeCorpusRepetition(messages, 3)).toBe(0);
    });

    it("computes average pairwise overlap for 3 messages", () => {
      // msg0 and msg1 share "the quick brown" and "quick brown fox"
      // msg0 and msg2 share nothing
      // msg1 and msg2 share nothing
      const messages = [
        "the quick brown fox",
        "the quick brown dog",
        "alpha beta gamma delta",
      ];
      const result = computeCorpusRepetition(messages, 3);
      // pair (0,1): ngrams0 = {the quick brown, quick brown fox}, ngrams1 = {the quick brown, quick brown dog}
      //   intersection = {the quick brown} = 1, union = 3 => overlap = 1/3
      // pair (0,2): 0
      // pair (1,2): 0
      // average = (1/3 + 0 + 0) / 3 = 1/9
      expect(result).toBeCloseTo(1 / 9, 4);
    });
  });
});
