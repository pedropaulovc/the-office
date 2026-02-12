import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import {
  createMessage,
  createRunMessage,
  getChannel,
  listChannelMembers,
} from "@/db/queries";
import { connectionRegistry } from "@/messages/sse-registry";
import { withSpan, logInfo, logWarn } from "@/lib/telemetry";
import { enqueueRun } from "@/agents/mailbox";
import { executeRun } from "@/agents/orchestrator";

export const MAX_CHAIN_DEPTH = 3;

export interface SendMessageToolOptions {
  agentId: string;
  runId: string;
  channelId: string | null;
  chainDepth: number;
}

export function createSendMessageTool(opts: SendMessageToolOptions) {
  const { agentId, runId, channelId, chainDepth } = opts;
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

        // Enqueue response runs for DM recipients (agent-to-agent chains)
        void enqueueDmResponseRuns(agentId, targetChannelId, message.id, chainDepth);

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

/**
 * If the target channel is a DM and chain depth hasn't been exceeded,
 * enqueue response runs for the other DM member(s).
 */
async function enqueueDmResponseRuns(
  senderAgentId: string,
  channelId: string,
  messageId: string,
  currentChainDepth: number,
): Promise<void> {
  return withSpan("dm_chain.enqueue", "agent.chain", async () => {
    const nextDepth = currentChainDepth + 1;

    if (nextDepth > MAX_CHAIN_DEPTH) {
      logInfo("dm chain depth limit reached, not enqueuing response", {
        senderAgentId,
        channelId,
        currentChainDepth,
        maxChainDepth: MAX_CHAIN_DEPTH,
      });
      return;
    }

    const channel = await getChannel(channelId);
    if (channel?.kind !== "dm") {
      return;
    }

    const members = await listChannelMembers(channelId);
    const recipients = members.filter((id) => id !== senderAgentId);

    for (const recipientId of recipients) {
      logInfo("enqueuing DM chain response", {
        senderAgentId,
        recipientId,
        channelId,
        chainDepth: nextDepth,
        triggerMessageId: messageId,
      });

      await enqueueRun(
        {
          agentId: recipientId,
          channelId,
          triggerMessageId: messageId,
          chainDepth: nextDepth,
        },
        executeRun,
      );
    }

    if (recipients.length === 0) {
      logWarn("dm channel has no other members", { channelId, senderAgentId });
    }
  });
}
