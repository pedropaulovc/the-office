import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_TINYTROUPE_REPO = '/mnt/c/src/tinytroupe';
const DEFAULT_BASELINE_PATH = path.join(
  process.cwd(),
  'src',
  'evaluation',
  'tinytroupe',
  'baselines',
  'table1.json'
);

const ARTIFACTS: Record<string, { artifact: string; label: string }> = {
  exp_1: {
    label: 'Brainstorming with average customers',
    artifact:
      'publications/paper_artifacts_june-2025/brainstorming_and_focus_group_quantitative_experimentation_1c.json',
  },
  exp_2_1: {
    label: 'Brainstorming with difficult customers (action + variety)',
    artifact:
      'publications/paper_artifacts_june-2025/brainstorming_and_focus_group_quantitative_experimentation_2.1c.json',
  },
  exp_2_2: {
    label: 'Brainstorming with difficult customers (variety only)',
    artifact:
      'publications/paper_artifacts_june-2025/brainstorming_and_focus_group_quantitative_experimentation_2.2b.json',
  },
  exp_3: {
    label: 'Debating controversial themes',
    artifact:
      'publications/paper_artifacts_june-2025/debating_quantitative_experimentation_1c.json',
  },
};

type MetricKey =
  | 'persona_adherence'
  | 'self_consistency'
  | 'fluency'
  | 'divergence'
  | 'ideas_qty';

type MetricStats = {
  t_mean: number;
  t_sd: number;
  c_mean: number;
  c_sd: number;
  delta: number;
  p_value: number | null;
};

type ExperimentReport = {
  label: string;
  metrics: Partial<Record<MetricKey, MetricStats>>;
};

type Table1Report = {
  generatedAt: string;
  experiments: Record<string, ExperimentReport>;
};

type BaselineMetric = {
  t_mean: number;
  t_sd: number;
  c_mean: number;
  c_sd: number;
  delta: number;
  p_value: number | string;
};

type Baseline = {
  experiments: Record<
    string,
    {
      label: string;
      na: number;
      ne: number;
      metrics: Record<string, BaselineMetric>;
    }
  >;
};

const METRIC_MAP: Record<string, MetricKey | null> = {
  'Hard Persona Adherence': 'persona_adherence',
  'Persona Adherence': 'persona_adherence',
  'Self-consistency': 'self_consistency',
  Fluency: 'fluency',
  Divergence: 'divergence',
  ideas_qty: 'ideas_qty',
};

const METRICS: MetricKey[] = [
  'persona_adherence',
  'self_consistency',
  'fluency',
  'divergence',
  'ideas_qty',
];

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStd(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function parseArgs(argv: string[]): { out?: string; validate: boolean } {
  const result: { out?: string; validate: boolean } = { validate: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') {
      result.out = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--validate') {
      result.validate = true;
    }
  }
  return result;
}

function normalizeMetrics(input: Record<string, unknown>): Record<MetricKey, number[]> {
  const normalized: Partial<Record<MetricKey, number[]>> = {};
  for (const [key, value] of Object.entries(input)) {
    const metric = METRIC_MAP[key];
    if (!metric) continue;
    if (!Array.isArray(value)) continue;
    normalized[metric] = value.filter((item) => typeof item === 'number') as number[];
  }
  const result: Record<MetricKey, number[]> = {
    persona_adherence: normalized.persona_adherence ?? [],
    self_consistency: normalized.self_consistency ?? [],
    fluency: normalized.fluency ?? [],
    divergence: normalized.divergence ?? [],
    ideas_qty: normalized.ideas_qty ?? [],
  };
  return result;
}

function extractPValues(
  stats: Record<string, Record<string, { p_value?: number }>> | undefined
): Record<MetricKey, number | null> {
  if (!stats) {
    return {
      persona_adherence: null,
      self_consistency: null,
      fluency: null,
      divergence: null,
      ideas_qty: null,
    };
  }
  const treatmentStats = stats.Treatment ?? {};
  const mapped: Record<MetricKey, number | null> = {
    persona_adherence: null,
    self_consistency: null,
    fluency: null,
    divergence: null,
    ideas_qty: null,
  };
  for (const [metricName, result] of Object.entries(treatmentStats)) {
    const metric = METRIC_MAP[metricName];
    if (!metric) continue;
    if (typeof result?.p_value === 'number') {
      mapped[metric] = result.p_value;
    }
  }
  return mapped;
}

async function loadArtifact(filePath: string): Promise<any> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function buildReport(): Promise<Table1Report> {
  const repoDir = process.env.TINYTROUPE_REPO_DIR ?? DEFAULT_TINYTROUPE_REPO;
  const experiments: Record<string, ExperimentReport> = {};

  for (const [code, info] of Object.entries(ARTIFACTS)) {
    const artifactPath = path.join(repoDir, info.artifact);
    const artifact = await loadArtifact(artifactPath);
    const control = artifact?.experiments?.Control?.results ?? {};
    const treatment = artifact?.experiments?.Treatment?.results ?? {};
    const pValues = extractPValues(
      artifact?.experiments?.Control?.statistical_test_results_vs_others
    );

    const controlMetrics = normalizeMetrics(control);
    const treatmentMetrics = normalizeMetrics(treatment);

    const metrics: Partial<Record<MetricKey, MetricStats>> = {};
    for (const metric of METRICS) {
      if (controlMetrics[metric].length === 0 && treatmentMetrics[metric].length === 0) {
        continue;
      }
      const cMean = mean(controlMetrics[metric]);
      const tMean = mean(treatmentMetrics[metric]);
      const cSd = sampleStd(controlMetrics[metric], cMean);
      const tSd = sampleStd(treatmentMetrics[metric], tMean);
      metrics[metric] = {
        t_mean: tMean,
        t_sd: tSd,
        c_mean: cMean,
        c_sd: cSd,
        delta: tMean - cMean,
        p_value: pValues[metric],
      };
    }

    experiments[code] = {
      label: info.label,
      metrics,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    experiments,
  };
}

function parseBaselinePValue(value: number | string): { threshold?: number; exact?: number } {
  if (typeof value === 'number') {
    return { exact: value };
  }
  const trimmed = value.trim();
  if (trimmed.startsWith('<')) {
    const num = Number(trimmed.slice(1));
    return Number.isFinite(num) ? { threshold: num } : {};
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? { exact: parsed } : {};
}

function compareNumbers(actual: number, expected: number, tolerance: number): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function validateReport(report: Table1Report, baseline: Baseline) {
  const failures: string[] = [];
  const tolerance = 0.01;
  const pTolerance = 1e-3;

  for (const [expCode, expBaseline] of Object.entries(baseline.experiments)) {
    const expReport = report.experiments[expCode];
    if (!expReport) {
      failures.push(`${expCode}: missing experiment`);
      continue;
    }
    for (const [metricKey, metricBaseline] of Object.entries(expBaseline.metrics)) {
      const metric = expReport.metrics[metricKey as MetricKey];
      if (!metric) {
        failures.push(`${expCode}.${metricKey}: missing metric`);
        continue;
      }
      if (!compareNumbers(metric.t_mean, metricBaseline.t_mean, tolerance)) {
        failures.push(`${expCode}.${metricKey}: t_mean mismatch`);
      }
      if (!compareNumbers(metric.t_sd, metricBaseline.t_sd, tolerance)) {
        failures.push(`${expCode}.${metricKey}: t_sd mismatch`);
      }
      if (!compareNumbers(metric.c_mean, metricBaseline.c_mean, tolerance)) {
        failures.push(`${expCode}.${metricKey}: c_mean mismatch`);
      }
      if (!compareNumbers(metric.c_sd, metricBaseline.c_sd, tolerance)) {
        failures.push(`${expCode}.${metricKey}: c_sd mismatch`);
      }
      if (!compareNumbers(metric.delta, metricBaseline.delta, tolerance)) {
        failures.push(`${expCode}.${metricKey}: delta mismatch`);
      }
      const baselineP = parseBaselinePValue(metricBaseline.p_value);
      if (metric.p_value === null) {
        failures.push(`${expCode}.${metricKey}: p_value missing`);
      } else if (baselineP.threshold !== undefined) {
        if (!(metric.p_value <= baselineP.threshold)) {
          failures.push(`${expCode}.${metricKey}: p_value above threshold`);
        }
      } else if (baselineP.exact !== undefined) {
        if (!compareNumbers(metric.p_value, baselineP.exact, pTolerance)) {
          failures.push(`${expCode}.${metricKey}: p_value mismatch`);
        }
      }
    }
  }

  return failures;
}

async function loadBaseline(): Promise<Baseline> {
  const raw = await fs.readFile(DEFAULT_BASELINE_PATH, 'utf8');
  return JSON.parse(raw) as Baseline;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await buildReport();

  const output = JSON.stringify(report, null, 2);
  if (args.out) {
    await fs.writeFile(args.out, output);
  } else {
    process.stdout.write(`${output}\n`);
  }

  if (args.validate) {
    const baseline = await loadBaseline();
    const failures = validateReport(report, baseline);
    if (failures.length > 0) {
      process.stderr.write(`Table 1 validation failed:\n${failures.join('\n')}\n`);
      process.exitCode = 1;
    } else {
      process.stderr.write('Table 1 validation passed.\n');
    }
  }
}

main().catch((error) => {
  process.stderr.write(`Table 1 runner failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
