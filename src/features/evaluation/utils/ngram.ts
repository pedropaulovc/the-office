/**
 * N-gram utilities for fluency evaluation.
 *
 * Provides tokenization, n-gram extraction, Jaccard overlap computation,
 * and corpus-level repetition measurement.
 */

/**
 * Extract n-grams from text: lowercase, strip punctuation, split on whitespace,
 * then produce a sliding window of size `n`.
 */
export function extractNgrams(text: string, n: number): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (tokens.length < n) {
    return new Set();
  }

  const ngrams = new Set<string>();
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.add(tokens.slice(i, i + n).join(" "));
  }
  return ngrams;
}

/**
 * Compute Jaccard overlap between two n-gram sets: |intersection| / |union|.
 * Returns 0 if both sets are empty.
 */
export function computeOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 0;
  }

  let intersectionSize = 0;
  for (const gram of a) {
    if (b.has(gram)) {
      intersectionSize++;
    }
  }

  const unionSize = a.size + b.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * Compute average pairwise n-gram overlap across all message pairs.
 * Returns 0 if fewer than 2 messages are provided.
 */
export function computeCorpusRepetition(
  messages: string[],
  n: number,
): number {
  if (messages.length < 2) {
    return 0;
  }

  const ngramSets = messages.map((msg) => extractNgrams(msg, n));

  let totalOverlap = 0;
  let pairCount = 0;

  for (const [i, setA] of ngramSets.entries()) {
    for (const setB of ngramSets.slice(i + 1)) {
      totalOverlap += computeOverlap(setA, setB);
      pairCount++;
    }
  }

  return pairCount === 0 ? 0 : totalOverlap / pairCount;
}
