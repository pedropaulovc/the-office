import { test, expect, type APIRequestContext } from "@playwright/test";

// --- Response types ---

interface InvokeResponse {
  runId: string;
  status: string;
}

interface RunMessageResponse {
  id: string;
  runId: string;
  stepId: string | null;
  messageType: string;
  content: string;
  toolName: string | null;
  toolInput: unknown;
  createdAt: string;
}

interface RunStepResponse {
  id: string;
  runId: string;
  stepNumber: number;
  status: string;
  modelId: string;
  tokenUsage: unknown;
  createdAt: string;
  completedAt: string | null;
  messages: RunMessageResponse[];
}

interface RunWithStepsResponse {
  id: string;
  agentId: string;
  status: string;
  stopReason: string | null;
  channelId: string | null;
  chainDepth: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalCostUsd: number;
  } | null;
  steps: RunStepResponse[];
}

interface ChannelMessageResponse {
  id: string;
  channelId: string;
  userId: string;
  text: string;
  timestamp: string;
  reactions: { emoji: string; userIds: string[] }[];
  threadReplyCount: number;
}

interface MemoryBlockResponse {
  id: string;
  agentId: string;
  label: string;
  content: string;
  isShared: boolean;
  updatedAt: string;
}

interface ArchivalPassageResponse {
  id: string;
  agentId: string;
  content: string;
  tags: string[] | null;
  createdAt: string;
}

// --- Helpers ---

function swallow(_: unknown) {
  void _;
}

async function pollRunCompletion(
  request: APIRequestContext,
  runId: string,
  timeoutMs: number,
): Promise<RunWithStepsResponse> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await request.get(`/api/runs/${runId}`);
    expect(res.status()).toBe(200);
    const run = (await res.json()) as RunWithStepsResponse;
    if (["completed", "failed", "cancelled"].includes(run.status)) {
      return run;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Run ${runId} did not complete within ${timeoutMs}ms`);
}

async function invokeAgent(
  request: APIRequestContext,
  agentId: string,
  channelId: string,
): Promise<InvokeResponse> {
  const res = await request.post(`/api/agents/${agentId}/invoke`, {
    data: { channelId },
  });
  expect(res.status()).toBe(200);
  return (await res.json()) as InvokeResponse;
}

function flattenRunMessages(run: RunWithStepsResponse): RunMessageResponse[] {
  return run.steps.flatMap((step) => step.messages);
}

/** Match tool name accounting for MCP prefix (mcp__server__toolName). */
function toolNameMatches(recorded: string | null, target: string): boolean {
  if (!recorded) return false;
  if (recorded === target) return true;
  return recorded.endsWith(`__${target}`);
}

function getToolCalls(
  run: RunWithStepsResponse,
  toolName?: string,
): RunMessageResponse[] {
  const msgs = flattenRunMessages(run).filter(
    (m) => m.messageType === "tool_call_message",
  );
  if (!toolName) return msgs;
  return msgs.filter((m) => toolNameMatches(m.toolName, toolName));
}

function getToolReturns(
  run: RunWithStepsResponse,
  toolName?: string,
): RunMessageResponse[] {
  const msgs = flattenRunMessages(run).filter(
    (m) => m.messageType === "tool_return_message",
  );
  if (!toolName) return msgs;
  return msgs.filter((m) => toolNameMatches(m.toolName, toolName));
}

/** Clear an agent's sessionId so invocations start fresh (avoids stale resume). */
async function resetAgentSession(
  request: APIRequestContext,
  agentId: string,
): Promise<void> {
  const res = await request.patch(`/api/agents/${agentId}`, {
    data: { sessionId: null },
  });
  expect(res.status()).toBe(200);
}

async function seedMessage(
  request: APIRequestContext,
  channelId: string,
  userId: string,
  text: string,
): Promise<void> {
  const res = await request.post(`/api/channels/${channelId}/messages`, {
    data: { userId, text },
  });
  expect(res.status()).toBe(201);
}

async function createTestChannel(
  request: APIRequestContext,
  channelId: string,
  memberIds: string[],
): Promise<void> {
  const res = await request.post("/api/channels", {
    data: { id: channelId, name: channelId, kind: "public", memberIds },
  });
  expect(res.status()).toBe(201);
}

/** Ensure a completed run exists, re-invoking if the benchmark failed. */
async function ensureCompletedRun(
  request: APIRequestContext,
  run: RunWithStepsResponse,
  channelId: string,
  timeoutMs: number,
): Promise<RunWithStepsResponse> {
  if (run.status === "completed") return run;
  await resetAgentSession(request, "michael");
  await seedMessage(request, channelId, "jim", "Michael, share your thoughts!");
  const { runId } = await invokeAgent(request, "michael", channelId);
  return pollRunCompletion(request, runId, timeoutMs);
}

/** Verify every step with tool_call also has a tool_return (paired). */
function verifyToolPairing(steps: RunStepResponse[]) {
  for (const step of steps) {
    const stepCalls = step.messages.filter(
      (m) => m.messageType === "tool_call_message",
    );
    const stepReturns = step.messages.filter(
      (m) => m.messageType === "tool_return_message",
    );
    if (stepCalls.length > 0) {
      expect(stepReturns.length).toBeGreaterThanOrEqual(stepCalls.length);
    }
  }
}

/** Verify update_memory tool effect if the tool was called (non-deterministic). */
async function verifyUpdateMemoryEffect(
  request: APIRequestContext,
  toolCalls: RunMessageResponse[],
) {
  if (toolCalls.length === 0) return;
  const memRes = await request.get("/api/agents/michael/memory");
  expect(memRes.status()).toBe(200);
  const blocks = (await memRes.json()) as MemoryBlockResponse[];
  const testBlock = blocks.find((b) => b.label === "e2e-test-note");
  expect(testBlock).toBeDefined();
  expect(testBlock?.content ?? "").toContain("multi-tool test");
}

/** Verify store_memory tool effect if the tool was called (non-deterministic). */
async function verifyStoreMemoryEffect(
  request: APIRequestContext,
  toolCalls: RunMessageResponse[],
) {
  if (toolCalls.length === 0) return;
  const archRes = await request.get(
    "/api/agents/michael/archival?q=E2E+archival",
  );
  expect(archRes.status()).toBe(200);
  const passages = (await archRes.json()) as ArchivalPassageResponse[];
  const match = passages.find((p) => p.content.includes("E2E archival"));
  expect(match).toBeDefined();
}

/** Assert multi-step when both tools were used. */
function verifyMultiToolStepCount(
  run: RunWithStepsResponse,
  sendCalls: RunMessageResponse[],
  otherCalls: RunMessageResponse[],
) {
  if (sendCalls.length > 0 && otherCalls.length > 0) {
    expect(run.steps.length).toBeGreaterThanOrEqual(3);
  }
}

// --- Shared state ---

let SDK_TIMEOUT = 30_000;
let sharedChannelId: string;
let benchmarkRun: RunWithStepsResponse;
const isolatedChannels: string[] = [];

// --- Test suite ---

test.describe("orchestrator SDK", () => {
  test.describe.configure({ mode: "serial" });

  test.afterAll(async () => {
    const base =
      process.env.PLAYWRIGHT_BASE_URL ??
      `http://localhost:${process.env.E2E_PORT}`;

    // Delete shared channel (cascades messages)
    if (sharedChannelId) {
      await fetch(`${base}/api/channels/${sharedChannelId}`, {
        method: "DELETE",
      }).catch(swallow);
    }

    // Delete isolated channels
    for (const chId of isolatedChannels) {
      await fetch(`${base}/api/channels/${chId}`, {
        method: "DELETE",
      }).catch(swallow);
    }

    // Delete e2e memory blocks
    await fetch(`${base}/api/agents/michael/memory/e2e-test-note`, {
      method: "DELETE",
    }).catch(swallow);

    // Delete e2e archival passages
    const archRes = await fetch(
      `${base}/api/agents/michael/archival?q=E2E+archival`,
    ).catch(() => null);
    if (archRes?.ok) {
      const passages =
        (await archRes.json()) as ArchivalPassageResponse[];
      for (const p of passages) {
        await fetch(`${base}/api/agents/michael/archival/${p.id}`, {
          method: "DELETE",
        }).catch(swallow);
      }
    }
  });

  test("benchmark — measures SDK round-trip and sets timeout", async ({
    request,
  }) => {
    test.setTimeout(120_000);

    // Clear any stale session so SDK starts fresh, and ensure enough turns
    await resetAgentSession(request, "michael");
    const patchRes = await request.patch("/api/agents/michael", {
      data: { maxTurns: 25 },
    });
    expect(patchRes.status()).toBe(200);

    // Create shared channel
    sharedChannelId = `e2e-sdk-${Date.now()}`;
    await createTestChannel(request, sharedChannelId, ["michael", "jim"]);

    // Seed message from jim — keep it simple so the agent responds quickly
    await seedMessage(
      request,
      sharedChannelId,
      "jim",
      "Hi Michael",
    );

    // Invoke michael and measure round-trip
    const startMs = Date.now();
    const { runId } = await invokeAgent(request, "michael", sharedChannelId);
    benchmarkRun = await pollRunCompletion(request, runId, 120_000);
    const elapsedMs = Date.now() - startMs;

    // Set dynamic timeout for subsequent tests
    SDK_TIMEOUT = Math.max(elapsedMs * 2.5, 30_000);

    expect(["completed", "failed"]).toContain(benchmarkRun.status);
  });

  test("completed run has correct status, stop reason, and token usage", async ({
    request,
  }) => {
    test.setTimeout(SDK_TIMEOUT);

    // Use the benchmark run; retry once if it failed
    const run = await ensureCompletedRun(
      request,
      benchmarkRun,
      sharedChannelId,
      SDK_TIMEOUT,
    );
    benchmarkRun = run;

    expect(run.status).toBe("completed");
    expect(run.stopReason).toBe("end_turn");

    // Token usage
    expect(run.tokenUsage).not.toBeNull();
    const usage = run.tokenUsage as {
      inputTokens: number;
      outputTokens: number;
      totalCostUsd: number;
    };
    expect(usage.inputTokens).toBeGreaterThan(0);
    expect(usage.outputTokens).toBeGreaterThan(0);
    expect(usage.totalCostUsd).toBeGreaterThan(0);

    // Timestamps
    expect(run.startedAt).toBeTruthy();
    expect(run.completedAt).toBeTruthy();
    const startedAt = new Date(run.startedAt ?? 0).getTime();
    const completedAt = new Date(run.completedAt ?? 0).getTime();
    const createdAt = new Date(run.createdAt).getTime();
    expect(completedAt).toBeGreaterThan(startedAt);
    expect(startedAt).toBeGreaterThanOrEqual(createdAt);
  });

  test("run records assistant_message and tool messages", () => {
    test.setTimeout(SDK_TIMEOUT);

    const run = benchmarkRun;
    expect(run.status).toBe("completed");

    const allMessages = flattenRunMessages(run);

    // At least 1 assistant_message with non-empty content
    const assistantMsgs = allMessages.filter(
      (m) => m.messageType === "assistant_message",
    );
    expect(assistantMsgs.length).toBeGreaterThanOrEqual(1);
    expect(assistantMsgs[0]?.content).toBeTruthy();

    // At least 1 tool_call_message with toolName set
    const toolCalls = getToolCalls(run);
    expect(toolCalls.length).toBeGreaterThanOrEqual(1);
    for (const tc of toolCalls) {
      expect(tc.toolName).toBeTruthy();
    }

    // At least 1 tool_return_message
    const toolReturns = getToolReturns(run);
    expect(toolReturns.length).toBeGreaterThanOrEqual(1);

    // Verify tool pairing
    verifyToolPairing(run.steps);

    // Messages within each step have chronological timestamps
    for (const step of run.steps) {
      for (let i = 1; i < step.messages.length; i++) {
        const current = new Date(step.messages[i]?.createdAt ?? 0).getTime();
        const previous = new Date(
          step.messages[i - 1]?.createdAt ?? 0,
        ).getTime();
        expect(current).toBeGreaterThanOrEqual(previous);
      }
    }
  });

  test("run has multiple steps when agent uses tools", () => {
    test.setTimeout(SDK_TIMEOUT);

    const run = benchmarkRun;
    expect(run.status).toBe("completed");

    // Multi-turn execution: at least 2 steps
    expect(run.steps.length).toBeGreaterThanOrEqual(2);

    // Steps have incrementing stepNumbers starting at 1
    for (let i = 0; i < run.steps.length; i++) {
      expect(run.steps[i]?.stepNumber).toBe(i + 1);
    }

    // All steps completed
    for (const step of run.steps) {
      expect(step.status).toBe("completed");
    }

    // Each step has at least 1 message
    for (const step of run.steps) {
      expect(step.messages.length).toBeGreaterThanOrEqual(1);
    }

    // Step 1 should contain at least an assistant_message
    const step1 = run.steps[0];
    expect(step1).toBeDefined();
    const step1Types = step1?.messages.map((m) => m.messageType) ?? [];
    expect(step1Types).toContain("assistant_message");

    // At least one step should contain tool_call_message (agent used tools)
    const stepsWithToolCalls = run.steps.filter((s) =>
      s.messages.some((m) => m.messageType === "tool_call_message"),
    );
    expect(stepsWithToolCalls.length).toBeGreaterThanOrEqual(1);
  });

  test("agent uses send_message tool and message appears in DB", async ({
    request,
  }) => {
    test.setTimeout(SDK_TIMEOUT);

    // Reset session to avoid stale resume issues
    await resetAgentSession(request, "michael");

    // Create isolated channel
    const isolatedId = `e2e-sdk-send-${Date.now()}`;
    isolatedChannels.push(isolatedId);
    await createTestChannel(request, isolatedId, ["michael", "jim"]);
    await seedMessage(
      request,
      isolatedId,
      "jim",
      "Hey Michael, what do you think about the Scranton branch?",
    );

    // Get initial message count
    const beforeRes = await request.get(
      `/api/channels/${isolatedId}/messages`,
    );
    const beforeMessages =
      (await beforeRes.json()) as ChannelMessageResponse[];
    const beforeCount = beforeMessages.length;

    // Invoke michael
    const { runId } = await invokeAgent(request, "michael", isolatedId);
    const run = await pollRunCompletion(request, runId, SDK_TIMEOUT);
    expect(run.status, `Run failed with stopReason: ${run.stopReason}`).toBe(
      "completed",
    );

    // Verify send_message tool_call exists
    const sendCalls = getToolCalls(run, "send_message");
    expect(sendCalls.length).toBeGreaterThanOrEqual(1);

    // The tool_call should have text in toolInput
    const firstCall = sendCalls[0];
    expect(firstCall).toBeDefined();
    const toolInput = firstCall?.toolInput as { text?: string } | undefined;
    expect(toolInput?.text).toBeTruthy();

    // Verify tool_return for send_message exists and contains messageId
    const sendReturns = run.steps.flatMap((s) =>
      s.messages.filter(
        (m) =>
          m.messageType === "tool_return_message" &&
          m.content.includes("messageId"),
      ),
    );
    expect(sendReturns.length).toBeGreaterThanOrEqual(1);

    // Verify message appears in channel
    const afterRes = await request.get(
      `/api/channels/${isolatedId}/messages`,
    );
    const afterMessages =
      (await afterRes.json()) as ChannelMessageResponse[];
    expect(afterMessages.length).toBeGreaterThan(beforeCount);

    const michaelMsgs = afterMessages.filter((m) => m.userId === "michael");
    expect(michaelMsgs.length).toBeGreaterThanOrEqual(1);
  });

  test("multi-tool stress — agent uses send_message + update_memory", async ({
    request,
  }) => {
    test.setTimeout(SDK_TIMEOUT);

    await resetAgentSession(request, "michael");
    const isolatedId = `e2e-sdk-multi1-${Date.now()}`;
    isolatedChannels.push(isolatedId);
    await createTestChannel(request, isolatedId, ["michael", "jim"]);
    await seedMessage(
      request,
      isolatedId,
      "jim",
      "Michael, I need you to do exactly two things: 1) Send a message in this channel confirming you got this, 2) Update your memory block with label 'e2e-test-note' to contain 'Jim requested a multi-tool test'. Both tasks are mandatory.",
    );

    const { runId } = await invokeAgent(request, "michael", isolatedId);
    const run = await pollRunCompletion(request, runId, SDK_TIMEOUT);
    expect(run.status, `Run failed with stopReason: ${run.stopReason}`).toBe(
      "completed",
    );

    // send_message is near-certain
    const sendCalls = getToolCalls(run, "send_message");
    expect(sendCalls.length).toBeGreaterThanOrEqual(1);

    // Verify michael's message in channel
    const msgRes = await request.get(
      `/api/channels/${isolatedId}/messages`,
    );
    const messages = (await msgRes.json()) as ChannelMessageResponse[];
    const michaelMsgs = messages.filter((m) => m.userId === "michael");
    expect(michaelMsgs.length).toBeGreaterThanOrEqual(1);

    // Verify update_memory effect (non-deterministic)
    const memoryCalls = getToolCalls(run, "update_memory");
    await verifyUpdateMemoryEffect(request, memoryCalls);

    // Verify multi-step when both tools were used
    verifyMultiToolStepCount(run, sendCalls, memoryCalls);
  });

  test("multi-tool stress — agent uses send_message + store_memory", async ({
    request,
  }) => {
    test.setTimeout(SDK_TIMEOUT);

    await resetAgentSession(request, "michael");
    const isolatedId = `e2e-sdk-multi2-${Date.now()}`;
    isolatedChannels.push(isolatedId);
    await createTestChannel(request, isolatedId, ["michael", "jim"]);
    await seedMessage(
      request,
      isolatedId,
      "jim",
      "Michael, please do these things: 1) Store a new archival memory with the content 'E2E archival test entry from Jim' and tag it with 'e2e-test', 2) Send a message confirming you stored it.",
    );

    const { runId } = await invokeAgent(request, "michael", isolatedId);
    const run = await pollRunCompletion(request, runId, SDK_TIMEOUT);
    expect(run.status, `Run failed with stopReason: ${run.stopReason}`).toBe(
      "completed",
    );

    // send_message is near-certain
    const sendCalls = getToolCalls(run, "send_message");
    expect(sendCalls.length).toBeGreaterThanOrEqual(1);

    // Verify store_memory effect (non-deterministic)
    const storeCalls = getToolCalls(run, "store_memory");
    await verifyStoreMemoryEffect(request, storeCalls);
  });

  test("session ID is persisted after invocation", async ({ request }) => {
    // After the SDK tests above, michael should have a sessionId
    const agentRes = await request.get("/api/agents/michael");
    expect(agentRes.status()).toBe(200);
    const agent = (await agentRes.json()) as { sessionId: string | null };
    expect(agent.sessionId).toBeTruthy();
    expect(typeof agent.sessionId).toBe("string");
  });

  test("invoke returns 404 for unknown agent", async ({ request }) => {
    const res = await request.post("/api/agents/nonexistent/invoke", {
      data: { channelId: "general" },
    });
    expect(res.status()).toBe(404);
  });

  test("invoke returns 400 for missing channelId", async ({ request }) => {
    const res = await request.post("/api/agents/michael/invoke", {
      data: {},
    });
    expect(res.status()).toBe(400);
  });
});
