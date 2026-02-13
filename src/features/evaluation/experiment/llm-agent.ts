import { getAnthropicClient, JUDGE_MODEL } from "@/lib/anthropic";
import {
  withSpan,
  logInfo,
  countMetric,
  distributionMetric,
} from "@/lib/telemetry";
import type { GeneratedPersona } from "./types";

type ConversationMessage = {
  role: "facilitator" | "agent";
  name: string;
  text: string;
};

type GenerateResponseOptions = {
  maxTokens?: number;
};

async function generateAgentResponse(
  persona: GeneratedPersona,
  conversationHistory: ConversationMessage[],
  options: GenerateResponseOptions = {},
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  return withSpan("experiment.agent.generate", "evaluation.llm", async () => {
    const client = getAnthropicClient();
    const maxTokens = options.maxTokens ?? 512;

    const historyText =
      conversationHistory.length > 0
        ? conversationHistory
            .map((msg) =>
              msg.role === "facilitator"
                ? `[Facilitator]: ${msg.text}`
                : `[${msg.name}]: ${msg.text}`,
            )
            .join("\n\n")
        : "[Facilitator]: Please introduce yourself and share your thoughts on the topic.";

    const userMessage = `Here is the conversation so far:\n\n${historyText}\n\nIt is now your turn to respond. Stay in character and contribute meaningfully to the discussion. Be concise (2-4 sentences).`;

    const response = await client.messages.create({
      model: JUDGE_MODEL,
      max_tokens: maxTokens,
      temperature: 0.7,
      system: persona.system_prompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const firstBlock = response.content[0];
    const text = firstBlock?.type === "text" ? firstBlock.text : "";

    countMetric("experiment.agent.llm_call", 1);
    distributionMetric(
      "experiment.agent.input_tokens",
      response.usage.input_tokens,
      "token",
    );
    distributionMetric(
      "experiment.agent.output_tokens",
      response.usage.output_tokens,
      "token",
    );

    logInfo("Agent response generated", {
      agentName: persona.name,
      responseLength: text.length,
    });

    return {
      text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  });
}

export { generateAgentResponse };
export type { ConversationMessage, GenerateResponseOptions };
