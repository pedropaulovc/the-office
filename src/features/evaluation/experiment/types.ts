export interface BigFiveTraits {
  openness: string;
  conscientiousness: string;
  extraversion: string;
  agreeableness: string;
  neuroticism: string;
}

export interface GeneratedPersona {
  name: string;
  sourceAgentId?: string;
  age: number;
  gender: string;
  nationality: string;
  residence: string;
  education: string;
  occupation: {
    title: string;
    organization: string;
    description: string;
  };
  personality: {
    traits: string[];
    big_five: BigFiveTraits;
  };
  style: string;
  long_term_goals: string[];
  preferences: {
    interests: string[];
    likes: string[];
    dislikes: string[];
  };
  system_prompt: string;
  memory_blocks: {
    personality: string;
    relationships: string;
    current_state: string;
  };
}

export type PopulationProfileId = "averageCustomer" | "difficultCustomer" | "politicalCompass";

export interface DemographicRange {
  kind: "range";
  min: number;
  max: number;
}

export interface DemographicList {
  kind: "list";
  values: string[];
}

export interface DemographicWeighted {
  kind: "weighted";
  values: Record<string, number>;
}

export type DemographicDistribution = DemographicRange | DemographicList | DemographicWeighted;

export interface PopulationProfile {
  id: PopulationProfileId;
  description: string;
  dimensions: {
    age: DemographicRange;
    gender: DemographicWeighted;
    nationality: DemographicList;
    education: DemographicList;
    occupations: DemographicList;
    personality_traits: DemographicList;
    big_five_bias: Partial<BigFiveTraits>;
    interests: DemographicList;
  };
}

// Experiment progress tracking

export type ExperimentPhase = 'setup' | 'generating_agents' | 'running_environments' | 'scoring' | 'completing';

export interface ExperimentProgress {
  phase: ExperimentPhase;
  environmentsProcessed: number;
  environmentsTotal: number;
  detail?: string;
}

export interface FactoryOptions {
  seed?: number;
  templateOnly?: boolean;
}

// Scenario types

export type ScenarioType = "brainstorming" | "debate";
export type AgentOrder = "parallel" | "sequential_random";

export interface FacilitatorPrompt {
  step: number;
  message: string;
}

export interface TreatmentConfig {
  action_correction: boolean;
  variety_intervention: boolean;
  correction_dimensions: string[];
  correction_threshold: number;
}

export interface ScenarioConfig {
  id: string;
  name: string;
  description: string;
  type: ScenarioType;
  population_profile: PopulationProfileId;
  agents_per_environment: number;
  total_environments: number;
  steps_per_environment: number;
  facilitator_prompts: FacilitatorPrompt[];
  agent_order: AgentOrder;
  treatment: TreatmentConfig;
  evaluation_dimensions: string[];
}
