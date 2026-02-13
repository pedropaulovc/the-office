/**
 * Text-statistics utilities for convergence/divergence evaluation.
 *
 * Provides tokenization, vocabulary analysis, and pairwise similarity
 * between agents' message corpora.
 */

/**
 * Lowercase, strip punctuation, split on whitespace.
 * Returns an array of lowercase tokens.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

export interface VocabularyStats {
  uniqueWordRatio: number;
  avgSentenceLength: number;
  punctuationDensity: number;
}

/**
 * Compute vocabulary statistics across a set of messages.
 *
 * - `uniqueWordRatio` = unique words / total words
 * - `avgSentenceLength` = total words / number of sentences (split on `.`, `!`, `?`)
 * - `punctuationDensity` = punctuation characters / total characters
 */
export function computeVocabularyStats(messages: string[]): VocabularyStats {
  const allText = messages.join(" ");
  const tokens = tokenize(allText);

  if (tokens.length === 0) {
    return { uniqueWordRatio: 0, avgSentenceLength: 0, punctuationDensity: 0 };
  }

  const uniqueWords = new Set(tokens);
  const uniqueWordRatio = uniqueWords.size / tokens.length;

  // Count sentences by splitting on sentence-ending punctuation
  const sentences = allText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = Math.max(sentences.length, 1);
  const avgSentenceLength = tokens.length / sentenceCount;

  // Punctuation density: count punctuation chars over total chars
  const totalChars = allText.length;
  const punctuationChars = (allText.match(/[^\w\s]/g) ?? []).length;
  const punctuationDensity = totalChars > 0 ? punctuationChars / totalChars : 0;

  return { uniqueWordRatio, avgSentenceLength, punctuationDensity };
}

/**
 * Compute pairwise Jaccard similarity of unique word sets between agents.
 *
 * Takes a map of agentId → list of messages. For each pair of agents,
 * computes the Jaccard similarity of their unique word sets.
 *
 * Returns a map where key is "agentA-agentB" (alphabetically sorted)
 * and value is the similarity (0–1).
 */
export function computePairwiseSimilarity(
  agentMessages: Map<string, string[]>,
): Map<string, number> {
  const agentWordSets = new Map<string, Set<string>>();

  for (const [agentId, messages] of agentMessages) {
    const allTokens = messages.flatMap(tokenize);
    agentWordSets.set(agentId, new Set(allTokens));
  }

  const agentIds = [...agentWordSets.keys()].sort();
  const result = new Map<string, number>();

  for (const [i, idA] of agentIds.entries()) {
    for (const idB of agentIds.slice(i + 1)) {
      const setA = agentWordSets.get(idA) ?? new Set<string>();
      const setB = agentWordSets.get(idB) ?? new Set<string>();

      if (setA.size === 0 && setB.size === 0) {
        result.set(`${idA}-${idB}`, 0);
        continue;
      }

      let intersectionSize = 0;
      for (const word of setA) {
        if (setB.has(word)) intersectionSize++;
      }
      const unionSize = setA.size + setB.size - intersectionSize;
      const similarity = unionSize === 0 ? 0 : intersectionSize / unionSize;

      result.set(`${idA}-${idB}`, similarity);
    }
  }

  return result;
}
