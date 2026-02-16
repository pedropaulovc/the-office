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

/** Mutable ref for passing accumulated thinking text from orchestrator to tools. */
export interface ThinkingRef {
  current: string | null;
}

export interface ToolServerOptions {
  sendMessage?: SendMessageToolOptions;
}

export interface Toolkit {
  definitions: Tool[];
  handlers: Map<string, (input: unknown) => Promise<ToolResult>>;
}

/**
 * Returns tool definitions (Anthropic SDK format) and handlers for the agentic loop.
 */
export function getToolkit(
  agentId: string,
  runId: string,
  channelId: string | null,
  chainDepth = 0,
  executor?: RunExecutor,
  toolOptions?: ToolServerOptions,
  thinkingRef?: ThinkingRef,
): Toolkit {
  const tools = [
    createSendMessageTool(agentId, runId, channelId, chainDepth, executor, toolOptions?.sendMessage, thinkingRef),
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
