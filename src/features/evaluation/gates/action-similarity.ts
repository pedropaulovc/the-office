import type { SimilarityResult } from "./types";

/**
 * Tokenize text: lowercase, strip punctuation, split on whitespace.
 */
function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 0);
  return new Set(tokens);
}

/**
 * Compute Jaccard similarity between two token sets: |intersection| / |union|.
 * Returns 0 if both sets are empty.
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;

  let intersectionSize = 0;
  for (const token of a) {
    if (b.has(token)) intersectionSize++;
  }

  const unionSize = a.size + b.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * Compute action similarity between a proposed message and recent messages.
 *
 * Tokenizes all texts (lowercase, strip punctuation, split whitespace),
 * computes Jaccard similarity for each pair, and returns the max similarity
 * along with the most similar message.
 *
 * Purely algorithmic -- no LLM call.
 */
export function computeActionSimilarity(
  proposedText: string,
  recentMessages: string[],
  threshold = 0.6,
): SimilarityResult {
  if (recentMessages.length === 0) {
    return { score: 0, passed: true, threshold };
  }

  const proposedTokens = tokenize(proposedText);
  let maxSimilarity = 0;
  let mostSimilarMessage: string | undefined;

  for (const msg of recentMessages) {
    const msgTokens = tokenize(msg);
    const similarity = jaccardSimilarity(proposedTokens, msgTokens);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      mostSimilarMessage = msg;
    }
  }

  const passed = maxSimilarity <= threshold;

  return {
    score: maxSimilarity,
    passed,
    threshold,
    ...(mostSimilarMessage !== undefined ? { mostSimilarMessage } : {}),
  };
}
