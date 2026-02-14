import type { ScenarioConfig } from "../types";

export const brainstormingDifficultFull: ScenarioConfig = {
  id: "brainstorming-difficult-full",
  name: "Brainstorming — Difficult Customers, Full Treatment (Exp. 2.1)",
  description: "Focus group with difficult/confrontational customers, both action correction and variety intervention active. Matches TinyTroupe Experiment 2.1: N_a=96, N_e=24.",
  type: "brainstorming",
  population_profile: "difficultCustomer",
  agents_per_environment: 4,
  total_environments: 24,
  steps_per_environment: 3,
  facilitator_prompts: [
    {
      step: 0,
      message: "Thank you for joining this focus group. We're gathering feedback on a new premium financial advisory service. What are your expectations for such a service? What would make you trust or distrust it?",
    },
    {
      step: 1,
      message: "Some of you have raised strong concerns. Let's dig deeper — what specific features or guarantees would you need to feel confident using this service? Challenge each other's assumptions.",
    },
    {
      step: 2,
      message: "Final question: if this service existed today, what would be the single biggest reason you would NOT use it? Be brutally honest.",
    },
  ],
  agent_order: "sequential_random",
  treatment: {
    action_correction: true,
    variety_intervention: true,
    correction_dimensions: ["adherence", "consistency"],
    correction_threshold: 7,
  },
  evaluation_dimensions: ["adherence", "consistency", "fluency", "convergence", "ideas_quantity"],
};
