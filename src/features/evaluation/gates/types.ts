export type QualityDimension = 'persona_adherence' | 'self_consistency' | 'fluency' | 'suitability';

export interface DimensionResult {
  dimension: QualityDimension;
  score: number;  // 0-9
  reasoning: string;
  passed: boolean;
  threshold: number;
}

export interface SimilarityResult {
  score: number;  // 0-1
  passed: boolean;
  threshold: number;
  mostSimilarMessage?: string;
}

export interface GateResult {
  passed: boolean;
  dimensionResults: DimensionResult[];
  similarityResult: SimilarityResult | null;
  totalScore: number;  // sum of all dimension scores
  tokenUsage?: { input_tokens: number; output_tokens: number } | undefined;
}

export interface GateConfig {
  dimensions: {
    persona_adherence: { enabled: boolean; threshold: number };
    self_consistency: { enabled: boolean; threshold: number };
    fluency: { enabled: boolean; threshold: number };
    suitability: { enabled: boolean; threshold: number };
  };
  similarity: { enabled: boolean; threshold: number };
}

export const DEFAULT_GATE_CONFIG: GateConfig = {
  dimensions: {
    persona_adherence: { enabled: false, threshold: 7 },
    self_consistency: { enabled: false, threshold: 7 },
    fluency: { enabled: false, threshold: 7 },
    suitability: { enabled: false, threshold: 7 },
  },
  similarity: { enabled: false, threshold: 0.6 },
};

// ---------------------------------------------------------------------------
// Correction Pipeline Types (S-7.0b)
// ---------------------------------------------------------------------------

export type CorrectionStage = 'original' | 'regeneration' | 'direct_correction';

export type CorrectionOutcome =
  | 'passed'
  | 'regeneration_requested'
  | 'regeneration_success'
  | 'direct_correction_success'
  | 'forced_through'
  | 'timeout_pass_through';

export interface CorrectionAttempt {
  stage: CorrectionStage;
  attemptNumber: number;
  messageText: string;
  gateResult: GateResult;
}

export interface CorrectionPipelineConfig extends GateConfig {
  enableRegeneration: boolean;
  enableDirectCorrection: boolean;
  maxCorrectionAttempts: number;
  continueOnFailure: boolean;
  minimumRequiredQtyOfActions: number;
}

export const DEFAULT_PIPELINE_CONFIG: CorrectionPipelineConfig = {
  ...DEFAULT_GATE_CONFIG,
  enableRegeneration: true,
  enableDirectCorrection: false,
  maxCorrectionAttempts: 2,
  continueOnFailure: true,
  minimumRequiredQtyOfActions: 0,
};

export interface RegenerationFeedback {
  tentativeAction: string;
  failedDimensions: {
    dimension: QualityDimension;
    score: number;
    threshold: number;
    reasoning: string;
    recommendation: string;
  }[];
  attemptNumber: number;
  maxAttempts: number;
}

export interface CorrectionPipelineResult {
  finalText: string;
  outcome: CorrectionOutcome;
  attempts: CorrectionAttempt[];
  bestAttempt: CorrectionAttempt;
  feedback: RegenerationFeedback | null;
  totalDurationMs: number;
}

export interface GateStatistics {
  totalActions: number;
  originalPassCount: number;
  originalPassRate: number;
  regenerationCount: number;
  regenerationSuccessCount: number;
  regenerationFailureRate: number;
  regenerationMeanScore: number;
  regenerationSdScore: number;
  directCorrectionCount: number;
  directCorrectionSuccessCount: number;
  directCorrectionFailureRate: number;
  directCorrectionMeanScore: number;
  directCorrectionSdScore: number;
  forcedThroughCount: number;
  similarityFailureCount: number;
  perDimensionFailureCounts: Record<QualityDimension, number>;
  perDimensionMeanScores: Record<QualityDimension, number>;
}
