import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { createReaction, createRunMessage, getMessage } from "@/db/queries";
import { connectionRegistry } from "@/messages/sse-registry";
import { withSpan } from "@/lib/telemetry";

export function createReactToMessageTool(agentId: string, runId: string) {
  return tool(
    "react_to_message",
    "Add an emoji reaction to a message.",
    {
      messageId: z.string().min(1).describe("The message to react to"),
      emoji: z.string().min(1).describe("The emoji to react with"),
    },
    async (args) => {
      return withSpan("tool.react_to_message", "agent.tool", async () => {
        await createRunMessage({
          runId,
          stepId: null,
          messageType: "tool_call_message",
          toolName: "react_to_message",
          toolInput: args,
          content: JSON.stringify(args),
        });

        const reaction = await createReaction({
          messageId: args.messageId,
          userId: agentId,
          emoji: args.emoji,
        });

        const targetMessage = await getMessage(args.messageId);
        if (targetMessage) {
          connectionRegistry.broadcast(targetMessage.channelId, {
            type: "reaction_added",
            channelId: targetMessage.channelId,
            data: reaction,
          });
        }

        const result = JSON.stringify({ success: true });

        await createRunMessage({
          runId,
          stepId: null,
          messageType: "tool_return_message",
          toolName: "react_to_message",
          content: result,
        });

        return { content: [{ type: "text" as const, text: result }] };
      });
    },
  );
}
