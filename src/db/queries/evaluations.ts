import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db/client";
import {
  evaluationRuns,
  evaluationScores,
  type EvaluationRun,
  type NewEvaluationRun,
  type EvaluationScore,
  type NewEvaluationScore,
} from "@/db/schema";
import type { EvaluationRunWithScores } from "@/features/evaluation/types";
import { withSpan, logInfo } from "@/lib/telemetry";

export function createEvaluationRun(
  data: NewEvaluationRun,
): Promise<EvaluationRun> {
  return withSpan("createEvaluationRun", "db.query", async () => {
    const rows = await db.insert(evaluationRuns).values(data).returning();
    const created = rows[0];
    if (!created) throw new Error("Insert returned no rows");
    return created;
  });
}

export function getEvaluationRun(
  id: string,
): Promise<EvaluationRun | undefined> {
  return withSpan("getEvaluationRun", "db.query", async () => {
    const rows = await db
      .select()
      .from(evaluationRuns)
      .where(eq(evaluationRuns.id, id));
    return rows[0];
  });
}

export function getEvaluationRunWithScores(
  id: string,
): Promise<EvaluationRunWithScores | undefined> {
  return withSpan("getEvaluationRunWithScores", "db.query", async () => {
    const [runRows, scoreRows] = await Promise.all([
      db.select().from(evaluationRuns).where(eq(evaluationRuns.id, id)),
      db
        .select()
        .from(evaluationScores)
        .where(eq(evaluationScores.evaluationRunId, id))
        .orderBy(evaluationScores.createdAt),
    ]);

    const run = runRows[0];
    if (!run) return undefined;

    return { ...run, scores: scoreRows };
  });
}

export function updateEvaluationRunStatus(
  id: string,
  update: {
    status: EvaluationRun["status"];
    overallScore?: number | null;
    tokenUsage?: EvaluationRun["tokenUsage"];
    sampleSize?: number;
  },
): Promise<EvaluationRun | undefined> {
  return withSpan("updateEvaluationRunStatus", "db.query", async () => {
    logInfo("updateEvaluationRunStatus", {
      runId: id,
      newStatus: update.status,
      ...(update.overallScore !== undefined && { overallScore: update.overallScore ?? -1 }),
    });
    const sets: Record<string, unknown> = { status: update.status };

    if (update.overallScore !== undefined) {
      sets.overallScore = update.overallScore;
    }
    if (update.tokenUsage !== undefined) {
      sets.tokenUsage = update.tokenUsage;
    }
    if (update.sampleSize !== undefined) {
      sets.sampleSize = update.sampleSize;
    }
    if (update.status === "completed" || update.status === "failed") {
      sets.completedAt = new Date();
    }

    const rows = await db
      .update(evaluationRuns)
      .set(sets)
      .where(eq(evaluationRuns.id, id))
      .returning();
    return rows[0];
  });
}

export function listEvaluationRuns(
  filters?: {
    agentId?: string;
    status?: string;
    isBaseline?: boolean;
  },
): Promise<EvaluationRun[]> {
  return withSpan("listEvaluationRuns", "db.query", async () => {
    const conditions = [];

    if (filters?.agentId) {
      conditions.push(eq(evaluationRuns.agentId, filters.agentId));
    }
    if (filters?.status) {
      conditions.push(
        eq(
          evaluationRuns.status,
          filters.status as EvaluationRun["status"],
        ),
      );
    }
    if (filters?.isBaseline !== undefined) {
      conditions.push(eq(evaluationRuns.isBaseline, filters.isBaseline));
    }

    if (conditions.length === 0) {
      return db
        .select()
        .from(evaluationRuns)
        .orderBy(desc(evaluationRuns.createdAt));
    }

    const [first, ...rest] = conditions;
    const where = rest.length === 0 ? first : and(first, ...rest);
    return db
      .select()
      .from(evaluationRuns)
      .where(where)
      .orderBy(desc(evaluationRuns.createdAt));
  });
}

export function getAgentScoreHistory(
  agentId: string,
  limit = 10,
): Promise<EvaluationRun[]> {
  return withSpan("getAgentScoreHistory", "db.query", async () => {
    return db
      .select()
      .from(evaluationRuns)
      .where(
        and(
          eq(evaluationRuns.agentId, agentId),
          eq(evaluationRuns.status, "completed"),
        ),
      )
      .orderBy(desc(evaluationRuns.createdAt))
      .limit(limit);
  });
}

export function recordScore(
  data: NewEvaluationScore,
): Promise<EvaluationScore> {
  return withSpan("recordScore", "db.query", async () => {
    const rows = await db.insert(evaluationScores).values(data).returning();
    const created = rows[0];
    if (!created) throw new Error("Insert returned no rows");
    return created;
  });
}

export function deleteEvaluationRun(
  id: string,
): Promise<EvaluationRun | undefined> {
  return withSpan("deleteEvaluationRun", "db.query", async () => {
    const rows = await db
      .delete(evaluationRuns)
      .where(eq(evaluationRuns.id, id))
      .returning();
    return rows[0];
  });
}
