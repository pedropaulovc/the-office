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
