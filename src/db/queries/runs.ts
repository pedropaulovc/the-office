import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  runs,
  runSteps,
  runMessages,
  type Run,
  type NewRun,
  type RunStep,
  type NewRunStep,
  type RunMessage,
  type NewRunMessage,
} from "@/db/schema";
import { withSpan } from "@/lib/telemetry";

export interface RunStatusUpdate {
  status: Run["status"];
  stopReason?: Run["stopReason"];
  tokenUsage?: Run["tokenUsage"];
}

export type RunWithHierarchy = Run & {
  steps: (RunStep & { messages: RunMessage[] })[];
};

export function createRun(data: NewRun): Promise<Run> {
  return withSpan("createRun", "db.query", async () => {
    const rows = await db.insert(runs).values(data).returning();
    const created = rows[0];
    if (!created) throw new Error("Insert returned no rows");
    return created;
  });
}

/**
 * Atomically claims the next queued run for an agent.
 * Uses an optimistic CAS (compare-and-swap) pattern compatible with
 * Neon's HTTP driver, which doesn't support FOR UPDATE SKIP LOCKED.
 * The outer `AND status = 'created'` ensures no double-claim if a
 * concurrent request selects the same row.
 * Returns null if no run is available or another run is already running.
 */
export function claimNextRun(agentId: string): Promise<Run | null> {
  return withSpan("claimNextRun", "db.query", async () => {
    const result = await db.execute(sql`
      UPDATE runs SET status = 'running', started_at = now()
      WHERE id = (
        SELECT id FROM runs
        WHERE agent_id = ${agentId} AND status = 'created'
          AND NOT EXISTS (
            SELECT 1 FROM runs r2
            WHERE r2.agent_id = ${agentId} AND r2.status = 'running'
          )
        ORDER BY created_at
        LIMIT 1
      )
      AND status = 'created'
      RETURNING *
    `);

    const row = result.rows[0];
    if (!row) return null;
    return mapRowToRun(row);
  });
}

export function updateRunStatus(
  id: string,
  update: RunStatusUpdate,
): Promise<Run | undefined> {
  return withSpan("updateRunStatus", "db.query", async () => {
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
  });
}

export function getRun(id: string): Promise<Run | undefined> {
  return withSpan("getRun", "db.query", async () => {
    const rows = await db.select().from(runs).where(eq(runs.id, id));
    return rows[0];
  });
}

export function getRunWithSteps(
  id: string,
): Promise<RunWithHierarchy | undefined> {
  return withSpan("getRunWithSteps", "db.query", async () => {
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
  });
}

export function listRuns(
  filters?: { agentId?: string | undefined; status?: string | undefined },
): Promise<Run[]> {
  return withSpan("listRuns", "db.query", async () => {
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
  });
}

export function cancelRun(
  id: string,
): Promise<{ run: Run | undefined; error?: string }> {
  return withSpan("cancelRun", "db.query", async () => {
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
  });
}

// --- Run Steps ---

export async function createRunStep(data: NewRunStep): Promise<RunStep> {
  const rows = await db.insert(runSteps).values(data).returning();
  const created = rows[0];
  if (!created) throw new Error("Insert returned no rows");
  return created;
}

export async function updateRunStep(
  id: string,
  data: { status?: RunStep["status"]; tokenUsage?: RunStep["tokenUsage"] },
): Promise<RunStep | undefined> {
  const sets: Record<string, unknown> = {};
  if (data.status !== undefined) sets.status = data.status;
  if (data.tokenUsage !== undefined) sets.tokenUsage = data.tokenUsage;
  if (data.status === "completed" || data.status === "failed") {
    sets.completedAt = sql`now()`;
  }
  if (Object.keys(sets).length === 0) return undefined;

  const rows = await db
    .update(runSteps)
    .set(sets)
    .where(eq(runSteps.id, id))
    .returning();
  return rows[0];
}

// --- Run Messages ---

export function getAgentSendMessages(
  agentId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<RunMessage[]> {
  return withSpan("getAgentSendMessages", "db.query", () =>
    db
      .select({
        id: runMessages.id,
        runId: runMessages.runId,
        stepId: runMessages.stepId,
        messageType: runMessages.messageType,
        content: runMessages.content,
        toolName: runMessages.toolName,
        toolInput: runMessages.toolInput,
        createdAt: runMessages.createdAt,
      })
      .from(runMessages)
      .innerJoin(runs, eq(runMessages.runId, runs.id))
      .where(
        and(
          eq(runs.agentId, agentId),
          eq(runMessages.toolName, "send_message"),
          gte(runMessages.createdAt, windowStart),
          lte(runMessages.createdAt, windowEnd),
        ),
      )
      .orderBy(desc(runMessages.createdAt)),
  );
}

export async function createRunMessage(data: NewRunMessage): Promise<RunMessage> {
  const rows = await db.insert(runMessages).values(data).returning();
  const created = rows[0];
  if (!created) throw new Error("Insert returned no rows");
  return created;
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
    triggerPrompt: (row.trigger_prompt as string | null) ?? null,
    chainDepth: row.chain_depth as number,
    createdAt: new Date(row.created_at as string),
    startedAt: row.started_at ? new Date(row.started_at as string) : null,
    completedAt: row.completed_at
      ? new Date(row.completed_at as string)
      : null,
    tokenUsage: row.token_usage ?? null,
  };
}
