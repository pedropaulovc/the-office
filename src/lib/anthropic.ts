import Anthropic from "@anthropic-ai/sdk";

export const JUDGE_MODEL = "claude-haiku-4-5-20251001";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}
