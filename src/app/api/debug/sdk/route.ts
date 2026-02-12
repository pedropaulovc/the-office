import { query } from "@anthropic-ai/claude-agent-sdk";
import { jsonResponse } from "@/lib/api-response";
import { buildSdkEnv } from "@/agents/sdk-env";

export const maxDuration = 60;

export async function GET() {
  const startMs = Date.now();
  const stderrChunks: string[] = [];
  const messages: { type: string; elapsed: number }[] = [];

  try {
    const env = buildSdkEnv();

    const sdkQuery = query({
      prompt: "Say exactly: hello",
      options: {
        systemPrompt: "You are a test bot. Respond with exactly one word.",
        model: "claude-sonnet-4-5-20250929",
        maxTurns: 1,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        tools: [],
        env,
        stderr: (data: string) => {
          stderrChunks.push(data.trim());
        },
      },
    });

    for await (const msg of sdkQuery) {
      messages.push({ type: msg.type, elapsed: Date.now() - startMs });
      if (msg.type === "result") break;
    }

    return jsonResponse({
      status: "ok",
      durationMs: Date.now() - startMs,
      messageCount: messages.length,
      messages,
      stderr: stderrChunks,
    });
  } catch (err) {
    return jsonResponse({
      status: "error",
      durationMs: Date.now() - startMs,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      stderr: stderrChunks,
      messages,
    }, { status: 500 });
  }
}
