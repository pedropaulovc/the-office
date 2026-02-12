import type { Run, NewRun } from "@/db/schema";
import { createRun, claimNextRun, updateRunStatus, listRuns } from "@/db/queries";
import {
  withSpan,
  logInfo,
  logError,
  countMetric,
} from "@/lib/telemetry";

export interface SequentialRunInput {
  input: NewRun;
  executor: RunExecutor;
}

export interface RunResult {
  status?: Run["status"];
  stopReason?: Run["stopReason"];
  tokenUsage?: Run["tokenUsage"];
}

export type RunExecutor = (run: Run) => Promise<RunResult | undefined>;

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
      const result = await exec(run);
      await updateRunStatus(run.id, {
        status: result?.status ?? "completed",
        stopReason: result?.stopReason ?? "end_turn",
        tokenUsage: result?.tokenUsage,
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
 * Enqueues multiple runs and processes them sequentially, awaiting each
 * completion before starting the next. Used for group channel responses
 * so each agent sees prior agent responses in their context.
 *
 * Unlike fire-and-forget enqueueRun, this function blocks until all
 * runs have completed (or failed).
 */
export async function enqueueSequentialRuns(
  runs: SequentialRunInput[],
): Promise<Run[]> {
  return withSpan("enqueueSequentialRuns", "agent.mailbox.sequential", async () => {
    logInfo("sequential runs starting", {
      count: runs.length,
      agentIds: runs.map((r) => r.input.agentId).join(","),
    });
    countMetric("mailbox.sequential.batch", 1, { count: String(runs.length) });

    const completedRuns: Run[] = [];

    for (const { input, executor } of runs) {
      const run = await createRun(input);
      logInfo("sequential run enqueued", {
        runId: run.id,
        agentId: run.agentId,
        position: completedRuns.length + 1,
        total: runs.length,
      });
      countMetric("mailbox.enqueue", 1, { agentId: run.agentId });

      // Process synchronously — await completion before next agent
      await processNextRun(run.agentId, executor);

      completedRuns.push(run);
      logInfo("sequential run finished", {
        runId: run.id,
        agentId: run.agentId,
        position: completedRuns.length,
        total: runs.length,
      });
    }

    logInfo("sequential runs completed", {
      count: completedRuns.length,
    });

    return completedRuns;
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
