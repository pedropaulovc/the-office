import { z, toJSONSchema } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { listArchivalPassages, createRunMessage } from "@/db/queries";
import { withSpan } from "@/lib/telemetry";
import type { ToolResult } from "./registry";

const inputSchema = z.object({
  query: z.string().min(1).describe("The search query"),
});

export function createSearchMemoryTool(agentId: string, runId: string) {
  const definition: Tool = {
    name: "search_memory",
    description:
      "Search your archival memory for relevant passages. Use this to recall stored information.",
    input_schema: toJSONSchema(inputSchema) as Tool["input_schema"],
  };

  const handler = async (rawInput: unknown): Promise<ToolResult> => {
    return withSpan("tool.search_memory", "agent.tool", async () => {
      const args = inputSchema.parse(rawInput);

      await createRunMessage({
        runId,
        stepId: null,
        messageType: "tool_call_message",
        toolName: "search_memory",
        toolInput: args,
        content: JSON.stringify(args),
      });

      const passages = await listArchivalPassages(agentId, args.query);

      const result = JSON.stringify({
        passages: passages.map((p) => ({
          id: p.id,
          content: p.content,
          tags: p.tags,
        })),
      });

      await createRunMessage({
        runId,
        stepId: null,
        messageType: "tool_return_message",
        toolName: "search_memory",
        content: result,
      });

      return { content: [{ type: "text" as const, text: result }] };
    });
  };

  return { definition, handler };
}
