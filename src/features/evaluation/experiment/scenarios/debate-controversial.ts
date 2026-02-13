import type { ScenarioConfig } from "../types";

export const debateControversial: ScenarioConfig = {
  id: "debate-controversial",
  name: "Debate — Political Compass (Exp. 3)",
  description: "Agents with diverse political orientations debate a controversial topic. Action correction active, no variety intervention. Matches TinyTroupe Experiment 3: N_a=120, N_e=24.",
  type: "debate",
  population_profile: "politicalCompass",
  agents_per_environment: 5,
  total_environments: 24,
  steps_per_environment: 4,
  facilitator_prompts: [
    {
      step: 0,
      message: "Welcome to this debate. Today's topic: 'Should governments implement a universal basic income (UBI) to address technological unemployment?' Please state your initial position and reasoning.",
    },
    {
      step: 1,
      message: "Now respond to the arguments you've heard. Where do you agree or disagree with others? What evidence supports your position?",
    },
    {
      step: 2,
      message: "Let's address the strongest counterarguments. What is the best argument AGAINST your own position, and how would you respond to it?",
    },
    {
      step: 3,
      message: "Final statements. Has your position evolved during this debate? Summarize your conclusion and any areas of common ground you've found.",
    },
  ],
  agent_order: "sequential_random",
  treatment: {
    action_correction: true,
    variety_intervention: false,
    correction_dimensions: ["adherence"],
    correction_threshold: 7,
  },
  evaluation_dimensions: ["adherence", "consistency", "fluency", "convergence"],
};
