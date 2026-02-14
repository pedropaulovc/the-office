import { getAgentEvalConfig } from "@/db/queries";
import type { AgentEvaluationConfig } from "@/db/schema";
import type { CorrectionPipelineConfig } from "@/features/evaluation/gates/types";
import { DEFAULT_PIPELINE_CONFIG } from "@/features/evaluation/gates/types";
import { withSpan, logInfo } from "@/lib/telemetry";

export interface InterventionConfig {
  antiConvergenceEnabled: boolean;
  convergenceThreshold: number;
  varietyInterventionEnabled: boolean;
  varietyMessageThreshold: number;
}

export interface RepetitionConfig {
  enabled: boolean;
  threshold: number;
}

export interface ResolvedConfig {
  pipeline: CorrectionPipelineConfig;
  interventions: InterventionConfig;
  repetition: RepetitionConfig;
}

const DEFAULT_INTERVENTION_CONFIG: InterventionConfig = {
  antiConvergenceEnabled: false,
  convergenceThreshold: 0.6,
  varietyInterventionEnabled: false,
  varietyMessageThreshold: 7,
};

const DEFAULT_REPETITION_CONFIG: RepetitionConfig = {
  enabled: false,
  threshold: 0.3,
};

export const DEFAULT_RESOLVED_CONFIG: ResolvedConfig = {
  pipeline: DEFAULT_PIPELINE_CONFIG,
  interventions: DEFAULT_INTERVENTION_CONFIG,
  repetition: DEFAULT_REPETITION_CONFIG,
};

export function buildResolvedConfig(
  dbConfig: AgentEvaluationConfig,
): ResolvedConfig {
  return {
    pipeline: {
      dimensions: {
        persona_adherence: {
          enabled: dbConfig.gateAdherenceEnabled,
          threshold: dbConfig.gateAdherenceThreshold,
        },
        self_consistency: {
          enabled: dbConfig.gateConsistencyEnabled,
          threshold: dbConfig.gateConsistencyThreshold,
        },
        fluency: {
          enabled: dbConfig.gateFluencyEnabled,
          threshold: dbConfig.gateFluencyThreshold,
        },
        suitability: {
          enabled: dbConfig.gateSuitabilityEnabled,
          threshold: dbConfig.gateSuitabilityThreshold,
        },
      },
      similarity: {
        enabled: dbConfig.gateSimilarityEnabled,
        threshold: dbConfig.maxActionSimilarity,
      },
      enableRegeneration: dbConfig.enableRegeneration,
      enableDirectCorrection: dbConfig.enableDirectCorrection,
      maxCorrectionAttempts: dbConfig.maxCorrectionAttempts,
      continueOnFailure: dbConfig.continueOnFailure,
      minimumRequiredQtyOfActions: dbConfig.minimumRequiredQtyOfActions,
    },
    interventions: {
      antiConvergenceEnabled: dbConfig.antiConvergenceEnabled,
      convergenceThreshold: dbConfig.convergenceThreshold,
      varietyInterventionEnabled: dbConfig.varietyInterventionEnabled,
      varietyMessageThreshold: dbConfig.varietyMessageThreshold,
    },
    repetition: {
      enabled: dbConfig.repetitionSuppressionEnabled,
      threshold: dbConfig.repetitionThreshold,
    },
  };
}

export function resolveConfig(agentId: string): Promise<ResolvedConfig> {
  return withSpan("resolveConfig", "evaluation.config", async () => {
    const dbConfig = await getAgentEvalConfig(agentId);
    if (!dbConfig) {
      logInfo("resolveConfig.defaults", { agentId });
      return DEFAULT_RESOLVED_CONFIG;
    }
    logInfo("resolveConfig.loaded", { agentId });
    return buildResolvedConfig(dbConfig);
  });
}
