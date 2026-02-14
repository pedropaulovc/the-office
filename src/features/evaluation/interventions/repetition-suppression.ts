import { extractNgrams, computeCorpusRepetition } from "@/features/evaluation/utils/ngram";
import { getRecentAgentMessages } from "@/db/queries";
import { withSpan, logInfo, logChunked, countMetric } from "@/lib/telemetry";

const DEFAULT_THRESHOLD = 0.25;
const DEFAULT_N = 3;
const DEFAULT_FETCH_COUNT = 10;
const DEFAULT_DETECT_WINDOW = 5;

export interface RepetitionCheckResult {
  detected: boolean;
  overlapScore: number;
  repeatedNgrams: string[];
  context: string | null;
}

/**
 * Detect repetition in a set of message texts using n-gram overlap.
 * Pure function, no DB or LLM calls.
 */
export function detectRepetition(
  messageTexts: string[],
  threshold = DEFAULT_THRESHOLD,
  n = DEFAULT_N,
): { detected: boolean; overlapScore: number } {
  const overlapScore = computeCorpusRepetition(messageTexts, n);
  return { detected: overlapScore >= threshold, overlapScore };
}

/**
 * Find specific n-grams that appear in multiple messages.
 * Returns the repeated n-grams sorted by frequency.
 */
export function findRepeatedNgrams(
  messageTexts: string[],
  n = DEFAULT_N,
): string[] {
  const ngramSets = messageTexts.map((msg) => extractNgrams(msg, n));
  const frequency = new Map<string, number>();

  for (const ngramSet of ngramSets) {
    for (const ngram of ngramSet) {
      frequency.set(ngram, (frequency.get(ngram) ?? 0) + 1);
    }
  }

  // Keep only n-grams appearing in 2+ messages
  return [...frequency.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([ngram]) => ngram);
}

/**
 * Build the suppression context block to inject into the system prompt.
 */
export function buildRepetitionContext(
  messageTexts: string[],
  repeatedNgrams: string[],
): string {
  const messageList = messageTexts
    .map((msg, i) => `${i + 1}. "${msg}"`)
    .join("\n");

  const ngramList = repeatedNgrams.slice(0, 10).map((ng) => `"${ng}"`).join(", ");

  return `### Recent Messages You've Sent\n${messageList}\n\nIMPORTANT: You've been repeating similar phrases. Vary your language, sentence structure, and conversation starters. Do not reuse the following phrases: ${ngramList}`;
}

/**
 * Orchestrator-facing function: fetches agent's recent messages,
 * detects repetition, and builds context if needed.
 * Purely algorithmic — no LLM calls.
 */
export async function checkRepetitionSuppression(
  agentId: string,
  threshold = DEFAULT_THRESHOLD,
): Promise<RepetitionCheckResult> {
  return withSpan(
    "checkRepetitionSuppression",
    "evaluation.repetition",
    async () => {
      // Fetch a wider window to avoid seed-data displacement, but detect on last N
      const recentMessages = await getRecentAgentMessages(agentId, DEFAULT_FETCH_COUNT);
      const allTexts = recentMessages.map((m) => m.text);
      const detectTexts = allTexts.slice(-DEFAULT_DETECT_WINDOW);

      // Log the exact messages used for detection
      const msgSummary = recentMessages
        .map((m, i) => `  ${i + 1}. [${m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt)}] "${m.text.slice(0, 120)}"`)
        .join("\n");
      logInfo(`repetitionSuppression.messages.${agentId} | ${allTexts.length} fetched, ${detectTexts.length} in detect window:\n${msgSummary}`, {
        agentId,
        fetchedCount: allTexts.length,
        detectCount: detectTexts.length,
      });

      if (detectTexts.length < 2) {
        logInfo("repetitionSuppression.skipped", { agentId, reason: "insufficient_messages" });
        return { detected: false, overlapScore: 0, repeatedNgrams: [], context: null };
      }

      const { detected, overlapScore } = detectRepetition(detectTexts, threshold);
      const repeatedNgrams = detected ? findRepeatedNgrams(detectTexts) : [];
      const context = detected ? buildRepetitionContext(detectTexts, repeatedNgrams) : null;

      countMetric("repetitionSuppression.checked", 1, {
        agentId,
        detected: String(detected),
      });

      logInfo(`repetitionSuppression.result.${agentId} | detected=${detected} overlap=${overlapScore.toFixed(4)} threshold=${threshold} ngrams=${repeatedNgrams.length}`, {
        agentId,
        detected,
        overlapScore,
        repeatedNgramCount: repeatedNgrams.length,
      });

      if (context) {
        logChunked(`repetitionSuppression.context.${agentId}`, context, { agentId });
      }

      return { detected, overlapScore, repeatedNgrams, context };
    },
  );
}
