type ReferenceMetric = {
  treatment: { mean: number; sd: number };
  control: { mean: number; sd: number };
  delta: number;
  pValue: number;
  significant: boolean;
};

type ReferenceExperiment = {
  scenarioId: string;
  experimentLabel: string;
  treatment: string;
  agentsCount: number;
  environmentsCount: number;
  metrics: Record<string, ReferenceMetric>;
};

// Hard-coded values from TinyTroupe Table 1 (arXiv:2507.09788v1)
const TABLE1_REFERENCE: ReferenceExperiment[] = [
  {
    scenarioId: "brainstorming-average",
    experimentLabel: "Exp. 1",
    treatment: "AC+VI",
    agentsCount: 200,
    environmentsCount: 40,
    metrics: {
      adherence: {
        treatment: { mean: 5.81, sd: 1.66 },
        control: { mean: 6.72, sd: 1.5 },
        delta: -0.92,
        pValue: 0.001,
        significant: true,
      },
      consistency: {
        treatment: { mean: 5.0, sd: 1.79 },
        control: { mean: 7.16, sd: 1.15 },
        delta: -2.16,
        pValue: 0.001,
        significant: true,
      },
      fluency: {
        treatment: { mean: 6.75, sd: 1.02 },
        control: { mean: 7.27, sd: 0.65 },
        delta: -0.52,
        pValue: 0.001,
        significant: true,
      },
      convergence: {
        treatment: { mean: 6.15, sd: 1.08 },
        control: { mean: 6.63, sd: 1.05 },
        delta: -0.47,
        pValue: 0.05,
        significant: true,
      },
      ideas_quantity: {
        treatment: { mean: 8.28, sd: 2.34 },
        control: { mean: 3.85, sd: 2.01 },
        delta: 4.43,
        pValue: 0.001,
        significant: true,
      },
    },
  },
  {
    scenarioId: "brainstorming-difficult-full",
    experimentLabel: "Exp. 2.1",
    treatment: "AC+VI",
    agentsCount: 96,
    environmentsCount: 24,
    metrics: {
      adherence: {
        treatment: { mean: 4.95, sd: 1.09 },
        control: { mean: 4.15, sd: 1.39 },
        delta: 0.8,
        pValue: 0.001,
        significant: true,
      },
      consistency: {
        treatment: { mean: 3.54, sd: 1.44 },
        control: { mean: 5.6, sd: 1.51 },
        delta: -2.06,
        pValue: 0.001,
        significant: true,
      },
      fluency: {
        treatment: { mean: 3.22, sd: 1.45 },
        control: { mean: 6.34, sd: 1.35 },
        delta: -3.13,
        pValue: 0.001,
        significant: true,
      },
      convergence: {
        treatment: { mean: 4.88, sd: 1.94 },
        control: { mean: 6.29, sd: 1.12 },
        delta: -1.42,
        pValue: 0.004,
        significant: true,
      },
      ideas_quantity: {
        treatment: { mean: 2.45, sd: 1.54 },
        control: { mean: 4.17, sd: 2.5 },
        delta: -1.72,
        pValue: 0.008,
        significant: true,
      },
    },
  },
  {
    scenarioId: "brainstorming-difficult-variety",
    experimentLabel: "Exp. 2.2",
    treatment: "VI only",
    agentsCount: 96,
    environmentsCount: 24,
    metrics: {
      adherence: {
        treatment: { mean: 4.74, sd: 1.55 },
        control: { mean: 5.34, sd: 1.48 },
        delta: -0.6,
        pValue: 0.006,
        significant: true,
      },
      consistency: {
        treatment: { mean: 4.55, sd: 1.63 },
        control: { mean: 5.47, sd: 1.67 },
        delta: -0.92,
        pValue: 0.001,
        significant: true,
      },
      fluency: {
        treatment: { mean: 6.11, sd: 1.56 },
        control: { mean: 6.45, sd: 1.51 },
        delta: -0.33,
        pValue: 0.134,
        significant: false,
      },
      convergence: {
        treatment: { mean: 6.42, sd: 1.1 },
        control: { mean: 5.88, sd: 1.33 },
        delta: 0.54,
        pValue: 0.131,
        significant: false,
      },
      ideas_quantity: {
        treatment: { mean: 9.29, sd: 3.33 },
        control: { mean: 3.96, sd: 2.27 },
        delta: 5.33,
        pValue: 0.001,
        significant: true,
      },
    },
  },
  {
    scenarioId: "debate-controversial",
    experimentLabel: "Exp. 3",
    treatment: "AC only",
    agentsCount: 120,
    environmentsCount: 24,
    metrics: {
      adherence: {
        treatment: { mean: 6.63, sd: 1.34 },
        control: { mean: 6.16, sd: 1.59 },
        delta: 0.47,
        pValue: 0.015,
        significant: true,
      },
      consistency: {
        treatment: { mean: 6.79, sd: 1.63 },
        control: { mean: 5.81, sd: 2.37 },
        delta: 0.98,
        pValue: 0.001,
        significant: true,
      },
      fluency: {
        treatment: { mean: 6.38, sd: 1.2 },
        control: { mean: 6.48, sd: 1.04 },
        delta: -0.11,
        pValue: 0.454,
        significant: false,
      },
      convergence: {
        treatment: { mean: 4.92, sd: 2.24 },
        control: { mean: 5.04, sd: 2.29 },
        delta: -0.13,
        pValue: 0.849,
        significant: false,
      },
    },
  },
];

function getReference(scenarioId: string): ReferenceExperiment | undefined {
  return TABLE1_REFERENCE.find((r) => r.scenarioId === scenarioId);
}

function getAllReferences(): ReferenceExperiment[] {
  return TABLE1_REFERENCE;
}

export { TABLE1_REFERENCE, getReference, getAllReferences };
export type { ReferenceMetric, ReferenceExperiment };
