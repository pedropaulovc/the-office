import type { ScenarioConfig } from "../types";

export const brainstormingAverage: ScenarioConfig = {
  id: "brainstorming-average",
  name: "Brainstorming — Average Customers (Exp. 1)",
  description: "Market research focus group with average US customers brainstorming ideas for a luxury travel service. Matches TinyTroupe Experiment 1: N_a=200, N_e=40.",
  type: "brainstorming",
  population_profile: "averageCustomer",
  agents_per_environment: 5,
  total_environments: 40,
  steps_per_environment: 3,
  facilitator_prompts: [
    {
      step: 0,
      message: "Welcome to this focus group! We're exploring ideas for 'WanderLux', a new luxury travel service. WanderLux aims to provide personalized, immersive travel experiences for discerning travelers. Please share your initial thoughts — what would make a luxury travel service truly stand out?",
    },
    {
      step: 1,
      message: "Great ideas so far! Now, think about the pain points of travel planning. What frustrations have you experienced, and how could WanderLux solve them? Build on each other's ideas.",
    },
    {
      step: 2,
      message: "For our final round, let's think big. What innovative or unexpected features would make WanderLux irresistible? Don't hold back — even wild ideas are welcome.",
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
