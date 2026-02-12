import { spawn, type ChildProcess } from "child_process";
import { resolve } from "path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { jsonResponse } from "@/lib/api-response";
import { buildSdkEnv } from "@/agents/sdk-env";

export const maxDuration = 60;

interface SpawnResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/** Direct subprocess spawn test — bypasses SDK to check raw CLI behavior. */
async function testDirectSpawn(
  env: Record<string, string | undefined>,
): Promise<SpawnResult> {
  const cliPath = resolve(
    process.cwd(),
    "node_modules/@anthropic-ai/claude-agent-sdk/cli.js",
  );

  return new Promise<SpawnResult>((res) => {
    const start = Date.now();
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    const child: ChildProcess = spawn(process.execPath, [cliPath, "--version"], {
      env: { ...env, HOME: "/tmp" },
      timeout: 10_000,
    });

    const { stdout, stderr } = child;
    if (stdout) {
      stdout.on("data", (data: Buffer) => {
        stdoutChunks.push(data.toString());
      });
    }
    if (stderr) {
      stderr.on("data", (data: Buffer) => {
        stderrChunks.push(data.toString());
      });
    }
    child.on("close", (code: number | null) => {
      res({
        exitCode: code,
        stdout: stdoutChunks.join("").slice(0, 2000),
        stderr: stderrChunks.join("").slice(0, 2000),
        durationMs: Date.now() - start,
      });
    });
    child.on("error", (err: Error) => {
      res({
        exitCode: -1,
        stdout: stdoutChunks.join("").slice(0, 2000),
        stderr: `spawn error: ${err.message}`,
        durationMs: Date.now() - start,
      });
    });
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "sdk";
  const startMs = Date.now();

  // Mode 1: Direct subprocess spawn (fast, no API call)
  if (mode === "spawn") {
    const env = buildSdkEnv();
    const result = await testDirectSpawn(env);
    return jsonResponse({
      mode: "spawn",
      ...result,
      cwd: process.cwd(),
      nodeVersion: process.version,
      platform: process.platform,
      hasApiKey: !!process.env.ANTHROPIC_API_KEY,
      home: process.env.HOME,
    });
  }

  // Mode 2: Full SDK query
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
        env: { ...env, HOME: "/tmp" },
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
      mode: "sdk",
      status: "ok",
      durationMs: Date.now() - startMs,
      messageCount: messages.length,
      messages,
      stderr: stderrChunks,
    });
  } catch (err) {
    return jsonResponse(
      {
        mode: "sdk",
        status: "error",
        durationMs: Date.now() - startMs,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        stderr: stderrChunks,
        messages,
      },
      { status: 500 },
    );
  }
}
