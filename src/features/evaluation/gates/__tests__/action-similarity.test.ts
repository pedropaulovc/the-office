import { describe, it, expect } from "vitest";
import { computeActionSimilarity } from "../action-similarity";

describe("computeActionSimilarity", () => {
  it("returns 0 similarity for no recent messages", () => {
    const result = computeActionSimilarity("Hello world", []);

    expect(result.score).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.mostSimilarMessage).toBeUndefined();
  });

  it("returns 1.0 similarity for identical messages", () => {
    const text = "That's what she said!";
    const result = computeActionSimilarity(text, [text]);

    expect(result.score).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.mostSimilarMessage).toBe(text);
  });

  it("returns 0 similarity for completely different messages", () => {
    const result = computeActionSimilarity("alpha beta gamma", [
      "one two three",
      "four five six",
    ]);

    expect(result.score).toBe(0);
    expect(result.passed).toBe(true);
  });

  it("computes partial similarity correctly", () => {
    const result = computeActionSimilarity("the quick brown fox", [
      "the slow brown dog",
    ]);

    // proposed tokens: {the, quick, brown, fox}
    // recent tokens:   {the, slow, brown, dog}
    // intersection: {the, brown} = 2
    // union: {the, quick, brown, fox, slow, dog} = 6
    // Jaccard = 2/6 = 0.333...
    expect(result.score).toBeCloseTo(1 / 3, 5);
    expect(result.passed).toBe(true);
  });

  it("returns the most similar message when multiple exist", () => {
    const result = computeActionSimilarity("hello world foo bar", [
      "completely different words here",
      "hello world foo baz",
      "unrelated content entirely",
    ]);

    expect(result.mostSimilarMessage).toBe("hello world foo baz");
  });

  it("strips punctuation before comparing", () => {
    const result = computeActionSimilarity(
      "Hello, world! How are you?",
      ["hello world how are you"],
    );

    expect(result.score).toBe(1);
  });

  it("is case-insensitive", () => {
    const result = computeActionSimilarity("HELLO WORLD", ["hello world"]);

    expect(result.score).toBe(1);
  });

  it("uses custom threshold", () => {
    const result = computeActionSimilarity("the quick brown fox", [
      "the slow brown dog",
    ], 0.2);

    // Jaccard = 2/6 = 0.333... > 0.2
    expect(result.passed).toBe(false);
    expect(result.threshold).toBe(0.2);
  });

  it("passes when similarity equals threshold", () => {
    // Create a pair where similarity is exactly 0.5
    // {a, b} vs {a, c} => intersection=1, union=3 => 1/3
    // {a, b} vs {a, b, c, d} => intersection=2, union=4 => 0.5
    const result = computeActionSimilarity("a b", ["a b c d"], 0.5);

    expect(result.score).toBe(0.5);
    expect(result.passed).toBe(true);
  });

  it("handles empty proposed text", () => {
    const result = computeActionSimilarity("", ["hello world"]);

    expect(result.score).toBe(0);
    expect(result.passed).toBe(true);
  });

  it("handles empty recent message text", () => {
    const result = computeActionSimilarity("hello world", [""]);

    expect(result.score).toBe(0);
    expect(result.passed).toBe(true);
  });
});
