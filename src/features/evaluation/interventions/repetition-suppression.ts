import { extractNgrams, computeCorpusRepetition } from "@/features/evaluation/utils/ngram";
import { getRecentAgentMessages } from "@/db/queries";
import { withSpan, logInfo, countMetric } from "@/lib/telemetry";

const DEFAULT_THRESHOLD = 0.3;
const DEFAULT_N = 3;
const DEFAULT_MESSAGE_COUNT = 5;

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
      const recentMessages = await getRecentAgentMessages(agentId, DEFAULT_MESSAGE_COUNT);
      const messageTexts = recentMessages.map((m) => m.text);

      if (messageTexts.length < 2) {
        logInfo("repetitionSuppression.skipped", { agentId, reason: "insufficient_messages" });
        return { detected: false, overlapScore: 0, repeatedNgrams: [], context: null };
      }

      const { detected, overlapScore } = detectRepetition(messageTexts, threshold);
      const repeatedNgrams = detected ? findRepeatedNgrams(messageTexts) : [];
      const context = detected ? buildRepetitionContext(messageTexts, repeatedNgrams) : null;

      countMetric("repetitionSuppression.checked", 1, {
        agentId,
        detected: String(detected),
      });

      logInfo("repetitionSuppression.result", {
        agentId,
        detected,
        overlapScore,
        repeatedNgramCount: repeatedNgrams.length,
      });

      return { detected, overlapScore, repeatedNgrams, context };
    },
  );
}
