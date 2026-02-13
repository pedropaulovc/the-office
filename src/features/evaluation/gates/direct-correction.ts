import { getAnthropicClient, JUDGE_MODEL } from "@/lib/anthropic";
import { withSpan, logInfo } from "@/lib/telemetry";
import type { QualityDimension } from "./types";

interface FailedDimension {
  dimension: QualityDimension;
  score: number;
  threshold: number;
  reasoning: string;
  recommendation: string;
}

interface DirectCorrectionContext {
  agentName: string;
  persona?: string | undefined;
  conversationContext?: string[] | undefined;
}

interface DirectCorrectionResult {
  correctedText: string;
  tokenUsage: { input_tokens: number; output_tokens: number };
}

const CORRECTION_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    corrected_text: { type: "string" },
  },
  required: ["corrected_text"],
  additionalProperties: false,
};

export async function directCorrect(
  messageText: string,
  failedDimensions: FailedDimension[],
  context: DirectCorrectionContext,
): Promise<DirectCorrectionResult> {
  return withSpan("gate.directCorrect", "evaluation.gate", async () => {
    const rulesSection = failedDimensions
      .map(
        (d) =>
          `- ${d.dimension} (score ${d.score}/${d.threshold}): ${d.reasoning}\n  Rule: ${d.recommendation}`,
      )
      .join("\n");

    const personaSection = context.persona
      ? `\n\nThe agent's persona:\n${context.persona}`
      : "";

    const conversationContext = context.conversationContext ?? [];
    const conversationSection =
      conversationContext.length > 0
        ? `\n\nRecent conversation:\n${conversationContext.map((m) => `- ${m}`).join("\n")}`
        : "";

    const prompt = `You are a text correction assistant. An AI agent named "${context.agentName}" generated a message that failed quality checks. Your job is to rewrite the message to fix the quality issues while preserving the agent's intended meaning and voice.${personaSection}${conversationSection}

The original message:
"${messageText}"

Quality check failures and corrective rules:
${rulesSection}

Rewrite the message to satisfy ALL corrective rules. Preserve the agent's voice and intended meaning as much as possible.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, 5000);

    try {
      const response = await getAnthropicClient().messages.create(
        {
          model: JUDGE_MODEL,
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
          output_config: {
            format: {
              type: "json_schema" as const,
              schema: CORRECTION_SCHEMA,
            },
          },
        },
        { signal: controller.signal },
      );

      clearTimeout(timeout);

      const textBlock = response.content.find((b) => b.type === "text");
      let correctedText = messageText;
      if (textBlock?.type === "text") {
        try {
          const parsed = JSON.parse(textBlock.text) as { corrected_text: string };
          correctedText = parsed.corrected_text;
        } catch {
          correctedText = textBlock.text.trim() || messageText;
        }
      }

      logInfo("gate.directCorrect.complete", {
        agentName: context.agentName,
        failedDimensions: failedDimensions.length,
        originalLength: messageText.length,
        correctedLength: correctedText.length,
      });

      return {
        correctedText,
        tokenUsage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        },
      };
    } catch (error) {
      clearTimeout(timeout);
      // Fail-open: return original text on timeout/error
      logInfo("gate.directCorrect.timeout", {
        agentName: context.agentName,
        error: error instanceof Error ? error.message : "unknown",
      });
      return {
        correctedText: messageText,
        tokenUsage: { input_tokens: 0, output_tokens: 0 },
      };
    }
  });
}
