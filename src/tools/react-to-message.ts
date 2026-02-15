import { z, toJSONSchema } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { createReaction, createRunMessage, getMessage } from "@/db/queries";
import { connectionRegistry } from "@/messages/sse-registry";
import { withSpan } from "@/lib/telemetry";
import type { ToolResult } from "./registry";

const inputSchema = z.object({
  messageId: z.string().min(1).describe("The message to react to"),
  emoji: z.string().min(1).describe("The emoji to react with"),
});

export function createReactToMessageTool(agentId: string, runId: string) {
  const definition: Tool = {
    name: "react_to_message",
    description: "Add an emoji reaction to a message.",
    input_schema: toJSONSchema(inputSchema) as Tool["input_schema"],
  };

  const handler = async (rawInput: unknown): Promise<ToolResult> => {
    return withSpan("tool.react_to_message", "agent.tool", async () => {
      const args = inputSchema.parse(rawInput);

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
  };

  return { definition, handler };
}
