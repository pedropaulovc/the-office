import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db/client";
import {
  experiments,
  experimentEnvironments,
  type Experiment,
  type NewExperiment,
  type ExperimentEnvironment,
  type NewExperimentEnvironment,
} from "@/db/schema";
import { withSpan, logInfo } from "@/lib/telemetry";

export function createExperiment(
  data: NewExperiment,
): Promise<Experiment> {
  return withSpan("createExperiment", "db.query", async () => {
    const rows = await db.insert(experiments).values(data).returning();
    const created = rows[0];
    if (!created) throw new Error("Insert returned no rows");
    logInfo("experiment created", { experimentId: created.id, scenarioId: created.scenarioId });
    return created;
  });
}

export function getExperiment(
  id: string,
): Promise<Experiment | undefined> {
  return withSpan("getExperiment", "db.query", async () => {
    const rows = await db
      .select()
      .from(experiments)
      .where(eq(experiments.id, id));
    return rows[0];
  });
}

export function listExperiments(
  filters?: {
    status?: string;
    scenarioId?: string;
  },
): Promise<Experiment[]> {
  return withSpan("listExperiments", "db.query", async () => {
    const conditions = [];

    if (filters?.status) {
      conditions.push(
        eq(experiments.status, filters.status as Experiment["status"]),
      );
    }
    if (filters?.scenarioId) {
      conditions.push(eq(experiments.scenarioId, filters.scenarioId));
    }

    if (conditions.length === 0) {
      return db
        .select()
        .from(experiments)
        .orderBy(desc(experiments.createdAt));
    }

    const [first, ...rest] = conditions;
    const where = rest.length === 0 ? first : and(first, ...rest);
    return db
      .select()
      .from(experiments)
      .where(where)
      .orderBy(desc(experiments.createdAt));
  });
}

export function updateExperiment(
  id: string,
  data: Partial<Pick<Experiment, "status" | "report" | "startedAt" | "completedAt" | "agentCount" | "environmentCount">>,
): Promise<Experiment | undefined> {
  return withSpan("updateExperiment", "db.query", async () => {
    const rows = await db
      .update(experiments)
      .set(data)
      .where(eq(experiments.id, id))
      .returning();
    return rows[0];
  });
}

export function deleteExperiment(
  id: string,
): Promise<Experiment | undefined> {
  return withSpan("deleteExperiment", "db.query", async () => {
    const rows = await db
      .delete(experiments)
      .where(eq(experiments.id, id))
      .returning();
    return rows[0];
  });
}

export function createExperimentEnvironment(
  data: NewExperimentEnvironment,
): Promise<ExperimentEnvironment> {
  return withSpan("createExperimentEnvironment", "db.query", async () => {
    const rows = await db.insert(experimentEnvironments).values(data).returning();
    const created = rows[0];
    if (!created) throw new Error("Insert returned no rows");
    return created;
  });
}

export function listExperimentEnvironments(
  experimentId: string,
): Promise<ExperimentEnvironment[]> {
  return withSpan("listExperimentEnvironments", "db.query", async () => {
    return db
      .select()
      .from(experimentEnvironments)
      .where(eq(experimentEnvironments.experimentId, experimentId))
      .orderBy(experimentEnvironments.environmentIndex);
  });
}
