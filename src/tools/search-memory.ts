import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { listArchivalPassages, createRunMessage } from "@/db/queries";
import { withSpan } from "@/lib/telemetry";

export function createSearchMemoryTool(agentId: string, runId: string) {
  return tool(
    "search_memory",
    "Search your archival memory for relevant passages. Use this to recall stored information.",
    {
      query: z.string().min(1).describe("The search query"),
    },
    async (args) => {
      return withSpan("tool.search_memory", "agent.tool", async () => {
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
    },
  );
}
