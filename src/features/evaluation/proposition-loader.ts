import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import yaml from "js-yaml";
import { propositionYamlSchema } from "@/features/evaluation/schemas";
import type {
  EvaluationDimension,
  PropositionFile,
} from "@/features/evaluation/types";
import { withSpan, logInfo, countMetric } from "@/lib/telemetry";

export interface TemplateVariables {
  agent_name?: string;
  action?: string;
  channel_name?: string;
  recipient_name?: string;
}

const PROPOSITIONS_DIR = resolve(
  process.cwd(),
  "src/features/evaluation/propositions",
);

/**
 * Replace `{{variable}}` placeholders in text with values from the variables map.
 * Unmatched placeholders are left as-is.
 */
export function fillTemplateVariables(
  text: string,
  variables: TemplateVariables,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = variables[key as keyof TemplateVariables];
    if (value === undefined) {
      return match;
    }
    return value;
  });
}

/**
 * Flip an inverted proposition's score: `9 - raw`.
 * Non-inverted scores pass through unchanged.
 */
export function applyInvertedScore(
  rawScore: number,
  inverted: boolean,
): number {
  if (!inverted) {
    return rawScore;
  }
  return 9 - rawScore;
}

/**
 * Apply hard-mode penalty: 20% reduction for any score below 9.
 * A perfect score of 9 is unaffected. Score < 9 is the proxy for
 * "any detected flaw" per TinyTroupe's evaluation approach.
 */
export function applyHardModePenalty(score: number, hard: boolean): number {
  if (!hard) {
    return score;
  }
  if (score >= 9) {
    return score;
  }
  return score * 0.8;
}

/**
 * Load a single proposition YAML file, validate it with Zod,
 * and fill template variables in proposition claims.
 */
export async function loadPropositionFile(
  filePath: string,
  variables?: TemplateVariables,
): Promise<PropositionFile> {
  return withSpan(
    "proposition-loader.loadFile",
    "evaluation.load",
    async () => {
      const raw = await readFile(filePath, "utf-8");
      const parsed: unknown = yaml.load(raw);
      const validated = propositionYamlSchema.parse(parsed);

      const vars = variables ?? {};

      const propositions = validated.propositions.map((p) => ({
        id: p.id,
        claim: fillTemplateVariables(p.claim, vars),
        weight: p.weight,
        inverted: p.inverted,
        recommendations_for_improvement: p.recommendations_for_improvement,
      }));

      logInfo("proposition file loaded", {
        filePath,
        propositionCount: propositions.length,
        dimension: validated.dimension,
      });
      countMetric("evaluation.propositions_loaded", propositions.length, {
        dimension: validated.dimension,
      });

      return {
        dimension: validated.dimension,
        agent_id: validated.agent_id,
        include_personas: validated.include_personas,
        hard: validated.hard,
        target_type: validated.target_type,
        first_n: validated.first_n,
        last_n: validated.last_n,
        propositions,
      };
    },
  );
}

/**
 * Load propositions for a given dimension.
 *
 * Loads `_default.yaml` first, then merges any agent-specific YAML
 * (matched by `agentId`) found in the same dimension directory.
 * Agent-specific propositions are appended after default ones.
 */
export async function loadPropositionsForDimension(
  dimension: EvaluationDimension,
  agentId?: string,
  variables?: TemplateVariables,
): Promise<PropositionFile> {
  return withSpan(
    "proposition-loader.loadDimension",
    "evaluation.load",
    async () => {
      const dimensionDir = join(PROPOSITIONS_DIR, dimension);
      const defaultPath = join(dimensionDir, "_default.yaml");

      const result = await loadPropositionFile(defaultPath, variables);

      if (!agentId) {
        return result;
      }

      const files = await readdir(dimensionDir);
      const agentFile = files.find(
        (f) => f === `${agentId}.yaml` || f === `${agentId}.yml`,
      );

      if (!agentFile) {
        logInfo("no agent-specific propositions found", {
          dimension,
          agentId,
        });
        return result;
      }

      const agentPath = join(dimensionDir, agentFile);
      const agentPropositions = await loadPropositionFile(agentPath, variables);

      logInfo("merging agent-specific propositions", {
        dimension,
        agentId,
        defaultCount: result.propositions.length,
        agentCount: agentPropositions.propositions.length,
      });

      return {
        dimension: result.dimension,
        agent_id: agentId,
        include_personas: agentPropositions.include_personas,
        hard: agentPropositions.hard,
        target_type: agentPropositions.target_type,
        first_n: agentPropositions.first_n ?? result.first_n,
        last_n: agentPropositions.last_n ?? result.last_n,
        propositions: [
          ...result.propositions,
          ...agentPropositions.propositions,
        ],
      };
    },
  );
}
