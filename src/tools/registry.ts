import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { createSendMessageTool, type SendMessageToolOptions } from "@/tools/send-message";
import { createReactToMessageTool } from "@/tools/react-to-message";
import { createDoNothingTool } from "@/tools/do-nothing";
import { createUpdateMemoryTool } from "@/tools/update-memory";
import { createSearchMemoryTool } from "@/tools/search-memory";
import { createStoreMemoryTool } from "@/tools/store-memory";
import type { RunExecutor } from "@/agents/mailbox";

export interface ToolServerOptions {
  sendMessage?: SendMessageToolOptions;
}

/**
 * Assembles all MCP tools for an agent run and returns a configured MCP server.
 */
export function getToolServer(
  agentId: string,
  runId: string,
  channelId: string | null,
  chainDepth = 0,
  executor?: RunExecutor,
  toolOptions?: ToolServerOptions,
) {
  const tools = [
    createSendMessageTool(agentId, runId, channelId, chainDepth, executor, toolOptions?.sendMessage),
    createReactToMessageTool(agentId, runId),
    createDoNothingTool(runId),
    createUpdateMemoryTool(agentId, runId),
    createSearchMemoryTool(agentId, runId),
    createStoreMemoryTool(agentId, runId),
  ];

  return createSdkMcpServer({ name: "office-tools", tools });
}
