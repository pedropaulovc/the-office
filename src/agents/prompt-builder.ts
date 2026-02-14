import * as Sentry from "@sentry/nextjs";
import type { Agent } from "@/db/schema";
import type { MemoryBlock } from "@/db/schema";
import type { DbMessage } from "@/db/schema";

type PromptAgent = Pick<Agent, "id" | "displayName" | "systemPrompt">;
type PromptMemoryBlock = Pick<MemoryBlock, "label" | "content">;
type PromptMessage = Pick<DbMessage, "userId" | "text" | "createdAt">;

export interface BuildSystemPromptInput {
  agent: PromptAgent;
  memoryBlocks: PromptMemoryBlock[];
  recentMessages: PromptMessage[];
  interventionNudge?: string | null;
  repetitionContext?: string | null;
}

const MAX_RECENT_MESSAGES = 20;

/**
 * Assembles the full system prompt for an agent invocation.
 * Wrapped in a Sentry span for observability.
 */
export function buildSystemPrompt(input: BuildSystemPromptInput): string {
  return Sentry.startSpan(
    { name: "buildSystemPrompt", op: "agent.prompt_build" },
    () => assemblePrompt(input),
  );
}

function assemblePrompt(input: BuildSystemPromptInput): string {
  const { agent, memoryBlocks, recentMessages } = input;
  const sections: string[] = [];

  // 1. Character persona (always first)
  sections.push(agent.systemPrompt);

  // 2. Core memory blocks (omitted if empty)
  if (memoryBlocks.length > 0) {
    const blocks = memoryBlocks
      .map((block) => `### ${block.label}\n${block.content}`)
      .join("\n\n");
    sections.push(`## Core Memory\n\n${blocks}`);
  }

  // 3. Tool usage instructions
  sections.push(TOOL_INSTRUCTIONS);

  // 4. Recent conversation context (omitted if empty)
  const messagesToInclude = recentMessages.slice(-MAX_RECENT_MESSAGES);
  if (messagesToInclude.length > 0) {
    const formatted = messagesToInclude.map(formatMessage).join("\n");
    sections.push(
      `## Recent Conversation\n\nThe following are the most recent messages in the current channel/DM:\n\n${formatted}`,
    );
  }

  // 5. Intervention nudge (transient — not stored in memory)
  if (input.interventionNudge) {
    sections.push(`### Conversation Guidance\n\n${input.interventionNudge}`);
  }

  // 6. Repetition suppression context (transient)
  if (input.repetitionContext) {
    sections.push(input.repetitionContext);
  }

  return sections.join("\n\n---\n\n");
}

function formatMessage(msg: PromptMessage): string {
  const timestamp =
    msg.createdAt instanceof Date
      ? msg.createdAt.toISOString()
      : String(msg.createdAt);
  return `[${timestamp}] ${msg.userId}: ${msg.text}`;
}

const TOOL_INSTRUCTIONS = `## Instructions

You communicate by using tools. You MUST use the \`send_message\` tool to send any messages. Never include message text in your response directly — always use the tool.

Available actions:
- **send_message**: Send a message to a channel or DM. This is how you speak.
- **react_to_message**: React to a message with an emoji.
- **update_memory**: Update one of your core memory blocks.
- **search_memory**: Search your archival memory for relevant information.
- **store_memory**: Store a new passage in your archival memory.
- **do_nothing**: Explicitly choose not to respond. Use this when the conversation does not require your input, when someone else is better suited to respond, or when you have nothing meaningful to add. Silence is a valid and often preferred choice.

Important:
- You MUST use \`send_message\` to communicate. Raw text output will be ignored.
- Consider using \`do_nothing\` when the message is not directed at you or when adding to the conversation would not be helpful.
- You are one of many agents in a shared workspace. Not every message needs a response from you.`;
