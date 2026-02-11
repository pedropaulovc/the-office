import type { Run, NewRun } from "@/db/schema";
import { createRun, claimNextRun, updateRunStatus, listRuns } from "@/db/queries";
import {
  withSpan,
  logInfo,
  logError,
  countMetric,
} from "@/lib/telemetry";

export type RunExecutor = (run: Run) => Promise<void>;

const stubExecutor: RunExecutor = (run: Run) => {
  logInfo("stub executor: no-op", { runId: run.id, agentId: run.agentId });
  return Promise.resolve();
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
 * Claims and processes the next queued run for an agent.
 * Recurses to drain the queue until no more runs are available.
 */
export async function processNextRun(
  agentId: string,
  executor?: RunExecutor,
): Promise<Run | null> {
  return withSpan("processNextRun", "agent.mailbox.dequeue", async () => {
    const run = await claimNextRun(agentId);
    if (!run) return null;

    logInfo("run claimed", { runId: run.id, agentId });
    countMetric("mailbox.dequeue", 1, { agentId });

    const exec = executor ?? stubExecutor;

    try {
      await exec(run);
      await updateRunStatus(run.id, {
        status: "completed",
        stopReason: "end_turn",
      });
      logInfo("run completed", { runId: run.id, agentId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError("run failed", { runId: run.id, agentId, error: message });
      await updateRunStatus(run.id, {
        status: "failed",
        stopReason: "error",
      });
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
