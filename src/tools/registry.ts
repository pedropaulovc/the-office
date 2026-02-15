import { createSdkMcpServer, tool as sdkTool } from "@anthropic-ai/claude-agent-sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { createSendMessageTool, type SendMessageToolOptions } from "@/tools/send-message";
import { createReactToMessageTool } from "@/tools/react-to-message";
import { createDoNothingTool } from "@/tools/do-nothing";
import { createUpdateMemoryTool } from "@/tools/update-memory";
import { createSearchMemoryTool } from "@/tools/search-memory";
import { createStoreMemoryTool } from "@/tools/store-memory";
import type { RunExecutor } from "@/agents/mailbox";

export interface ToolResult {
  content: { type: "text"; text: string }[];
}

export interface ToolServerOptions {
  sendMessage?: SendMessageToolOptions;
}

export interface Toolkit {
  definitions: Tool[];
  handlers: Map<string, (input: unknown) => Promise<ToolResult>>;
}

/**
 * New-style toolkit: returns tool definitions (Anthropic SDK format) and handlers.
 */
export function getToolkit(
  agentId: string,
  runId: string,
  channelId: string | null,
  chainDepth = 0,
  executor?: RunExecutor,
  toolOptions?: ToolServerOptions,
): Toolkit {
  const tools = [
    createSendMessageTool(agentId, runId, channelId, chainDepth, executor, toolOptions?.sendMessage),
    createReactToMessageTool(agentId, runId),
    createDoNothingTool(runId),
    createUpdateMemoryTool(agentId, runId),
    createSearchMemoryTool(agentId, runId),
    createStoreMemoryTool(agentId, runId),
  ];

  return {
    definitions: tools.map((t) => t.definition),
    handlers: new Map(tools.map((t) => [t.definition.name, t.handler])),
  };
}

/**
 * Backward-compatible wrapper for the orchestrator (uses claude-agent-sdk MCP server).
 * Will be removed in S-SDK-3 when the orchestrator is rewritten.
 */
export function getToolServer(
  agentId: string,
  runId: string,
  channelId: string | null,
  chainDepth = 0,
  executor?: RunExecutor,
  toolOptions?: ToolServerOptions,
) {
  const toolkit = getToolkit(agentId, runId, channelId, chainDepth, executor, toolOptions);

  const sdkTools = toolkit.definitions.map((def) => {
    const handler = toolkit.handlers.get(def.name);
    if (!handler) throw new Error(`Handler not found for tool: ${def.name}`);
    // Wrap new-style handlers back into SDK tool() format.
    // Empty schema {} — our handlers do their own Zod validation.
    return sdkTool(def.name, def.description ?? "", {}, async (args: Record<string, unknown>) => handler(args));
  });

  return createSdkMcpServer({ name: "office-tools", tools: sdkTools });
}
