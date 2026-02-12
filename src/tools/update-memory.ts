import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { upsertMemoryBlock, createRunMessage } from "@/db/queries";
import { withSpan } from "@/lib/telemetry";

export function createUpdateMemoryTool(agentId: string, runId: string) {
  return tool(
    "update_memory",
    "Update a memory block. Use this to store or update persistent information about yourself or your experiences.",
    {
      label: z.string().min(1).describe("The label/key for this memory block"),
      content: z.string().min(1).describe("The content to store"),
    },
    async (args) => {
      return withSpan("tool.update_memory", "agent.tool", async () => {
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
    },
  );
}
