import { tool } from "@anthropic-ai/claude-agent-sdk";
import { createRunMessage } from "@/db/queries";
import { withSpan } from "@/lib/telemetry";

export function createDoNothingTool(runId: string) {
  return tool(
    "do_nothing",
    "Explicitly choose not to respond. Use this when the conversation does not require your input.",
    {},
    async () => {
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
    },
  );
}
