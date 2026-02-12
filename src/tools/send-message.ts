import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { createMessage, createRunMessage } from "@/db/queries";
import { connectionRegistry } from "@/messages/sse-registry";
import { withSpan } from "@/lib/telemetry";

export function createSendMessageTool(
  agentId: string,
  runId: string,
  channelId: string | null,
) {
  return tool(
    "send_message",
    "Send a message to a channel. Use this to participate in conversations.",
    {
      channelId: z.string().min(1).optional().describe("The channel to send the message to (defaults to current channel)"),
      text: z.string().min(1).describe("The message text"),
    },
    async (args) => {
      return withSpan("tool.send_message", "agent.tool", async () => {
        const targetChannelId = args.channelId ?? channelId;
        if (!targetChannelId) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No channel specified" }) }] };
        }

        await createRunMessage({
          runId,
          stepId: null,
          messageType: "tool_call_message",
          toolName: "send_message",
          toolInput: args,
          content: JSON.stringify(args),
        });

        const message = await createMessage({
          channelId: targetChannelId,
          userId: agentId,
          text: args.text,
        });

        connectionRegistry.broadcast(targetChannelId, {
          type: "message_created",
          channelId: targetChannelId,
          data: message,
        });

        const result = JSON.stringify({ messageId: message.id });

        await createRunMessage({
          runId,
          stepId: null,
          messageType: "tool_return_message",
          toolName: "send_message",
          content: result,
        });

        return { content: [{ type: "text" as const, text: result }] };
      });
    },
  );
}
