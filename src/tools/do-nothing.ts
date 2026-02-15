import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { createRunMessage } from "@/db/queries";
import { withSpan } from "@/lib/telemetry";
import type { ToolResult } from "./registry";

export function createDoNothingTool(runId: string) {
  const definition: Tool = {
    name: "do_nothing",
    description:
      "Explicitly choose not to respond. Use this when the conversation does not require your input.",
    input_schema: { type: "object" as const, properties: {} },
  };

  const handler = async (): Promise<ToolResult> => {
    return withSpan("tool.do_nothing", "agent.tool", async () => {
      await createRunMessage({
        runId,
        stepId: null,
        messageType: "tool_call_message",
        toolName: "do_nothing",
        toolInput: {},
        content: "{}",
      });

      const result = JSON.stringify({ action: "none" });

      await createRunMessage({
        runId,
        stepId: null,
        messageType: "tool_return_message",
        toolName: "do_nothing",
        content: result,
      });

      return { content: [{ type: "text" as const, text: result }] };
    });
  };

  return { definition, handler };
}
