import { withSpan, logInfo, countMetric } from "@/lib/telemetry";
import {
  createExperiment,
  updateExperiment,
  createExperimentEnvironment,
} from "@/db/queries/experiments";
import { db } from "@/db/client";
import { agents as agentsTable, channels, channelMembers, messages } from "@/db/schema";
import type { Experiment } from "@/db/schema";
import type { ScenarioConfig, GeneratedPersona, ExperimentProgress } from "./types";
import type { EnvironmentPairResult } from "./environment-manager";
import type { EnvironmentResult } from "./environment";
import type { ExperimentReport } from "./experiment-report";
import { persistGeneratedPersona } from "./agent-adapter";

interface CreateExperimentOptions {
  scenario: ScenarioConfig;
  seed: number;
  scale: number;
  mode: "template" | "llm";
  populationSource: "generated" | "existing";
  sourceAgentIds?: string[];
}

/**
 * Creates an experiment record in the DB with status 'running'.
 */
export async function createExperimentRecord(
  options: CreateExperimentOptions,
): Promise<Experiment> {
  return withSpan("persistence.createExperimentRecord", "experiment.persistence", async () => {
    const experiment = await createExperiment({
      scenarioId: options.scenario.id,
      seed: options.seed,
      scale: options.scale,
      mode: options.mode,
      status: "running",
      populationSource: options.populationSource,
      sourceAgentIds: options.sourceAgentIds ?? null,
      config: options.scenario as unknown as Record<string, unknown>,
      agentCount: options.scenario.agents_per_environment * options.scenario.total_environments,
      environmentCount: options.scenario.total_environments,
      startedAt: new Date(),
    });
    logInfo("Created experiment record", { experimentId: experiment.id });
    countMetric("persistence.experiment_created", 1);
    return experiment;
  });
}

/**
 * Persists a treatment/control environment pair to the DB.
 * Creates agents (for generated populations), channels, messages, and experiment_environments rows.
 */
export async function persistEnvironmentPair(
  experimentId: string,
  envIndex: number,
  pair: EnvironmentPairResult,
  personas: GeneratedPersona[],
  populationSource: "generated" | "existing",
): Promise<void> {
  return withSpan("persistence.persistEnvironmentPair", "experiment.persistence", async () => {
    // For generated populations, batch-insert agents to DB
    let agentIds: string[];
    if (populationSource === "generated") {
      const agentValues = personas.map((p) => persistGeneratedPersona(p, experimentId));
      const agentRows = await db.insert(agentsTable).values(agentValues).returning();
      agentIds = agentRows.map((a) => a.id);
    } else {
      agentIds = personas.map((a) => a.name);
    }

    const shortId = experimentId.slice(0, 8);

    // Build all channel, member, message, and environment rows for both groups
    const channelValues: { id: string; name: string; kind: "private"; experimentId: string }[] = [];
    const memberValues: { channelId: string; userId: string }[] = [];
    const messageValues: { channelId: string; userId: string; text: string }[] = [];

    for (const group of ["treatment", "control"] as const) {
      const result: EnvironmentResult = pair[group];
      const channelId = `exp-${shortId}-env-${envIndex}-${group}`;

      channelValues.push({ id: channelId, name: channelId, kind: "private", experimentId });

      for (const agentId of agentIds) {
        memberValues.push({ channelId, userId: agentId });
      }

      for (const action of result.trajectory) {
        const agentId = populationSource === "generated"
          ? agentIds.find((id) => {
              const namePart = action.agentName.toLowerCase().replace(/\s+/g, "-").slice(0, 20);
              return id.includes(namePart);
            }) ?? agentIds[0] ?? "unknown"
          : action.agentName;
        messageValues.push({ channelId, userId: agentId, text: action.text });
      }
    }

    // Batch inserts: 3 round-trips instead of N
    await db.insert(channels).values(channelValues);
    if (memberValues.length > 0) {
      await db.insert(channelMembers).values(memberValues);
    }
    if (messageValues.length > 0) {
      await db.insert(messages).values(messageValues);
    }

    // Create experiment_environments rows (2 round-trips)
    for (const group of ["treatment", "control"] as const) {
      const channelId = `exp-${shortId}-env-${envIndex}-${group}`;
      await createExperimentEnvironment({
        experimentId,
        environmentIndex: envIndex,
        group,
        channelId,
        agentIds,
        trajectory: pair[group].trajectory as unknown as Record<string, unknown>,
      });
    }

    logInfo("Persisted environment pair", { experimentId, envIndex });
    countMetric("persistence.environment_persisted", 1);
  });
}

/**
 * Updates the progress field on an experiment record.
 */
export async function updateProgress(
  experimentId: string,
  progress: ExperimentProgress,
): Promise<void> {
  await updateExperiment(experimentId, { progress: progress as unknown as Record<string, unknown> });
}

/**
 * Updates an experiment as completed with its report.
 */
export async function completeExperiment(
  experimentId: string,
  report: ExperimentReport,
): Promise<void> {
  return withSpan("persistence.completeExperiment", "experiment.persistence", async () => {
    await updateExperiment(experimentId, {
      status: "completed",
      report: report as unknown as Record<string, unknown>,
      completedAt: new Date(),
    });
    logInfo("Experiment completed", { experimentId });
    countMetric("persistence.experiment_completed", 1);
  });
}

/**
 * Updates an experiment as failed with error info.
 */
export async function failExperiment(
  experimentId: string,
  error: string,
): Promise<void> {
  return withSpan("persistence.failExperiment", "experiment.persistence", async () => {
    await updateExperiment(experimentId, {
      status: "failed",
      report: { error } as unknown as Record<string, unknown>,
      completedAt: new Date(),
    });
    logInfo("Experiment failed", { experimentId, error });
    countMetric("persistence.experiment_failed", 1);
  });
}
