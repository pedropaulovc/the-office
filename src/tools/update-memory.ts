import { z, toJSONSchema } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { upsertMemoryBlock, createRunMessage } from "@/db/queries";
import { withSpan } from "@/lib/telemetry";
import type { ToolResult } from "./registry";

const inputSchema = z.object({
  label: z.string().min(1).describe("The label/key for this memory block"),
  content: z.string().min(1).describe("The content to store"),
});

export function createUpdateMemoryTool(agentId: string, runId: string) {
  const definition: Tool = {
    name: "update_memory",
    description:
      "Update a memory block. Use this to store or update persistent information about yourself or your experiences.",
    input_schema: toJSONSchema(inputSchema) as Tool["input_schema"],
  };

  const handler = async (rawInput: unknown): Promise<ToolResult> => {
    return withSpan("tool.update_memory", "agent.tool", async () => {
      const args = inputSchema.parse(rawInput);

      await createRunMessage({
        runId,
        stepId: null,
        messageType: "tool_call_message",
        toolName: "update_memory",
        toolInput: args,
        content: JSON.stringify(args),
      });

      await upsertMemoryBlock({
        agentId,
        label: args.label,
        content: args.content,
      });

      const result = JSON.stringify({ success: true });

      await createRunMessage({
        runId,
        stepId: null,
        messageType: "tool_return_message",
        toolName: "update_memory",
        content: result,
      });

      return { content: [{ type: "text" as const, text: result }] };
    });
  };

  return { definition, handler };
}
