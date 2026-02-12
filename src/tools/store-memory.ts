import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { createArchivalPassage, createRunMessage } from "@/db/queries";
import { withSpan } from "@/lib/telemetry";

export function createStoreMemoryTool(agentId: string, runId: string) {
  return tool(
    "store_memory",
    "Store a new passage in your archival memory. Use this to save important information for later recall.",
    {
      content: z.string().min(1).describe("The content to store"),
      tags: z.array(z.string()).optional().describe("Optional tags for categorization"),
    },
    async (args) => {
      return withSpan("tool.store_memory", "agent.tool", async () => {
        await createRunMessage({
          runId,
          stepId: null,
          messageType: "tool_call_message",
          toolName: "store_memory",
          toolInput: args,
          content: JSON.stringify(args),
        });

        const passage = await createArchivalPassage({
          agentId,
          content: args.content,
          tags: args.tags ?? null,
        });

        const result = JSON.stringify({ passageId: passage.id });

        await createRunMessage({
          runId,
          stepId: null,
          messageType: "tool_return_message",
          toolName: "store_memory",
          content: result,
        });

        return { content: [{ type: "text" as const, text: result }] };
      });
    },
  );
}
