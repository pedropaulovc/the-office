import { z, toJSONSchema } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { createArchivalPassage, createRunMessage } from "@/db/queries";
import { withSpan } from "@/lib/telemetry";
import type { ToolResult } from "./registry";

const inputSchema = z.object({
  content: z.string().min(1).describe("The content to store"),
  tags: z.array(z.string()).optional().describe("Optional tags for categorization"),
});

export function createStoreMemoryTool(agentId: string, runId: string) {
  const definition: Tool = {
    name: "store_memory",
    description:
      "Store a new passage in your archival memory. Use this to save important information for later recall.",
    input_schema: toJSONSchema(inputSchema) as Tool["input_schema"],
  };

  const handler = async (rawInput: unknown): Promise<ToolResult> => {
    return withSpan("tool.store_memory", "agent.tool", async () => {
      const args = inputSchema.parse(rawInput);

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
  };

  return { definition, handler };
}
