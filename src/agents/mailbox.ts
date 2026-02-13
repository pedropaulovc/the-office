import type { Run, NewRun } from "@/db/schema";
import * as Sentry from "@sentry/nextjs";
import { createRun, claimNextRun, updateRunStatus, listRuns } from "@/db/queries";
import {
  withSpan,
  logInfo,
  logError,
  countMetric,
  distributionMetric,
} from "@/lib/telemetry";

export interface RunResult {
  status?: Run["status"];
  stopReason?: Run["stopReason"];
  tokenUsage?: Run["tokenUsage"];
}

export type RunExecutor = (run: Run) => Promise<RunResult | undefined>;

/** Timeout for awaiting run completion (5 minutes). */
export const RUN_COMPLETION_TIMEOUT_MS = 5 * 60 * 1000;

/** In-memory registry for awaiting run completion (used by enqueueAndAwaitRun). */
const completionResolvers = new Map<string, () => void>();

function notifyRunCompletion(runId: string): void {
  const resolve = completionResolvers.get(runId);
  if (!resolve) return;
  resolve();
  completionResolvers.delete(runId);
}

const stubExecutor: RunExecutor = (run: Run) => {
  logInfo("stub executor: no-op", { runId: run.id, agentId: run.agentId });
  return Promise.resolve(undefined);
};

/**
 * Enqueues a new run for an agent and fire-and-forgets processing.
 */
export async function enqueueRun(
  input: NewRun,
  executor?: RunExecutor,
): Promise<Run> {
  return withSpan("enqueueRun", "agent.mailbox.enqueue", async () => {
    const run = await createRun(input);
    logInfo("run enqueued", { runId: run.id, agentId: run.agentId });
    countMetric("mailbox.enqueue", 1, { agentId: run.agentId });

    // Fire-and-forget: start processing the queue
    void processNextRun(run.agentId, executor);

    return run;
  });
}

/**
 * Enqueues a run and waits for it to complete before returning.
 * Used for sequential channel dispatch so each agent sees prior responses.
 */
export async function enqueueAndAwaitRun(
  input: NewRun,
  executor?: RunExecutor,
): Promise<Run> {
  return withSpan("enqueueAndAwaitRun", "agent.mailbox.enqueue_await", async () => {
    const run = await createRun(input);
    logInfo("run enqueued (awaiting)", { runId: run.id, agentId: run.agentId });
    countMetric("mailbox.enqueue_await", 1, { agentId: run.agentId });

    // Register completion listener BEFORE starting processing to avoid race
    const completionPromise = new Promise<void>((resolve, reject) => {
      completionResolvers.set(run.id, resolve);

      // Safety timeout: if processNextRun silently fails (e.g. claimNextRun
      // throws), the resolver would never fire. 5 min is well above any
      // legitimate agent invocation duration.
      setTimeout(() => {
        if (!completionResolvers.has(run.id)) return; // already resolved
        completionResolvers.delete(run.id);
        reject(new Error(`enqueueAndAwaitRun timed out for run ${run.id}`));
      }, RUN_COMPLETION_TIMEOUT_MS);
    });

    // Fire-and-forget: start processing the queue
    void processNextRun(run.agentId, executor);

    await completionPromise;
    return run;
  });
}

/**
 * Claims and processes the next queued run for an agent.
 * Recurses to drain the queue until no more runs are available.
 */
export async function processNextRun(
  agentId: string,
  executor?: RunExecutor,
): Promise<Run | null> {
  return withSpan("processNextRun", "agent.mailbox.dequeue", async () => {
    let run: Run | null;
    try {
      run = await claimNextRun(agentId);
    } catch (err) {
      logError("claimNextRun failed", {
        agentId,
        error: err instanceof Error ? err.message : String(err),
      });
      Sentry.captureException(err);
      return null;
    }

    if (!run) {
      logInfo("no run to claim", { agentId });
      return null;
    }

    logInfo("run claimed", { runId: run.id, agentId });
    countMetric("mailbox.dequeue", 1, { agentId });

    const exec = executor ?? stubExecutor;
    const startTime = Date.now();

    try {
      const result = await exec(run);
      const durationMs = Date.now() - startTime;
      await updateRunStatus(run.id, {
        status: result?.status ?? "completed",
        stopReason: result?.stopReason ?? "end_turn",
        tokenUsage: result?.tokenUsage,
      });
      logInfo("run completed", {
        runId: run.id,
        agentId,
        status: result?.status ?? "completed",
        stopReason: result?.stopReason ?? "end_turn",
        durationMs,
      });
      distributionMetric("mailbox.run_duration_ms", durationMs, "millisecond", { agentId });
      notifyRunCompletion(run.id);
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      logError("run execution failed", {
        runId: run.id,
        agentId,
        error: message,
        durationMs,
      });
      Sentry.captureException(err);
      await updateRunStatus(run.id, {
        status: "failed",
        stopReason: "error",
      });
      countMetric("mailbox.run_error", 1, { agentId });
      notifyRunCompletion(run.id);
    }

    // Recurse to drain the queue
    return processNextRun(agentId, executor);
  });
}

/**
 * Returns pending and running runs for an agent.
 */
export async function getAgentQueue(agentId: string): Promise<Run[]> {
  const [pending, running] = await Promise.all([
    listRuns({ agentId, status: "created" }),
    listRuns({ agentId, status: "running" }),
  ]);
  return [...running, ...pending];
}
