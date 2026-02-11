import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "@/db/client";
import {
  runs,
  runSteps,
  runMessages,
  type Run,
  type NewRun,
  type RunStep,
  type RunMessage,
} from "@/db/schema";

export interface RunStatusUpdate {
  status: Run["status"];
  stopReason?: Run["stopReason"];
  tokenUsage?: Run["tokenUsage"];
}

export type RunWithHierarchy = Run & {
  steps: (RunStep & { messages: RunMessage[] })[];
};

export async function createRun(data: NewRun): Promise<Run> {
  const rows = await db.insert(runs).values(data).returning();
  const created = rows[0];
  if (!created) throw new Error("Insert returned no rows");
  return created;
}

/**
 * Atomically claims the next queued run for an agent.
 * Uses FOR UPDATE SKIP LOCKED to prevent concurrent claims.
 * Returns null if no run is available or another run is already running.
 */
export async function claimNextRun(agentId: string): Promise<Run | null> {
  const result = await db.execute(sql`
    UPDATE runs SET status = 'running', started_at = now()
    WHERE id IN (
      SELECT id FROM runs
      WHERE agent_id = ${agentId} AND status = 'created'
        AND NOT EXISTS (
          SELECT 1 FROM runs r2
          WHERE r2.agent_id = ${agentId} AND r2.status = 'running'
        )
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `);

  const row = result.rows[0];
  if (!row) return null;
  return mapRowToRun(row);
}

export async function updateRunStatus(
  id: string,
  update: RunStatusUpdate,
): Promise<Run | undefined> {
  const sets: Record<string, unknown> = {
    status: update.status,
  };

  if (update.stopReason !== undefined) {
    sets.stopReason = update.stopReason;
  }
  if (update.tokenUsage !== undefined) {
    sets.tokenUsage = update.tokenUsage;
  }
  if (update.status === "running") {
    sets.startedAt = sql`now()`;
  }
  if (
    update.status === "completed" ||
    update.status === "failed" ||
    update.status === "cancelled"
  ) {
    sets.completedAt = sql`now()`;
  }

  const rows = await db
    .update(runs)
    .set(sets)
    .where(eq(runs.id, id))
    .returning();
  return rows[0];
}

export async function getRun(id: string): Promise<Run | undefined> {
  const rows = await db.select().from(runs).where(eq(runs.id, id));
  return rows[0];
}

export async function getRunWithSteps(
  id: string,
): Promise<RunWithHierarchy | undefined> {
  const [runRows, stepRows, messageRows] = await Promise.all([
    db.select().from(runs).where(eq(runs.id, id)),
    db
      .select()
      .from(runSteps)
      .where(eq(runSteps.runId, id))
      .orderBy(runSteps.stepNumber),
    db
      .select()
      .from(runMessages)
      .where(eq(runMessages.runId, id))
      .orderBy(runMessages.createdAt),
  ]);

  const run = runRows[0];
  if (!run) return undefined;

  const messagesByStep = new Map<string, RunMessage[]>();
  for (const msg of messageRows) {
    const stepId = msg.stepId ?? "__no_step__";
    const list = messagesByStep.get(stepId) ?? [];
    list.push(msg);
    messagesByStep.set(stepId, list);
  }

  const steps = stepRows.map((step) => ({
    ...step,
    messages: messagesByStep.get(step.id) ?? [],
  }));

  return { ...run, steps };
}

export async function listRuns(
  filters?: { agentId?: string | undefined; status?: string | undefined },
): Promise<Run[]> {
  const conditions = [];

  if (filters?.agentId) {
    conditions.push(eq(runs.agentId, filters.agentId));
  }
  if (filters?.status) {
    conditions.push(eq(runs.status, filters.status as Run["status"]));
  }

  if (conditions.length === 0) {
    return db.select().from(runs).orderBy(desc(runs.createdAt));
  }

  const [first, ...rest] = conditions;
  const where = rest.length === 0 ? first : and(first, ...rest);
  return db.select().from(runs).where(where).orderBy(desc(runs.createdAt));
}

export async function cancelRun(
  id: string,
): Promise<{ run: Run | undefined; error?: string }> {
  const existing = await getRun(id);
  if (!existing) return { run: undefined };

  const terminalStatuses = ["completed", "failed", "cancelled"];
  if (terminalStatuses.includes(existing.status)) {
    return {
      run: existing,
      error: `Cannot cancel run with status '${existing.status}'`,
    };
  }

  const updated = await updateRunStatus(id, {
    status: "cancelled",
    stopReason: "cancelled",
  });
  return { run: updated };
}

/** Maps a raw snake_case row from db.execute() to a camelCase Run type. */
function mapRowToRun(row: Record<string, unknown>): Run {
  return {
    id: row.id as string,
    agentId: row.agent_id as string,
    status: row.status as Run["status"],
    stopReason: (row.stop_reason as Run["stopReason"]) ?? null,
    triggerMessageId: (row.trigger_message_id as string | null) ?? null,
    channelId: (row.channel_id as string | null) ?? null,
    chainDepth: row.chain_depth as number,
    createdAt: new Date(row.created_at as string),
    startedAt: row.started_at ? new Date(row.started_at as string) : null,
    completedAt: row.completed_at
      ? new Date(row.completed_at as string)
      : null,
    tokenUsage: row.token_usage ?? null,
  };
}
