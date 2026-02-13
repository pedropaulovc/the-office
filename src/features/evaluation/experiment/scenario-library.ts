import type { ScenarioConfig } from "./types";
import { brainstormingAverage } from "./scenarios/brainstorming-average";
import { brainstormingDifficultFull } from "./scenarios/brainstorming-difficult-full";
import { brainstormingDifficultVariety } from "./scenarios/brainstorming-difficult-variety";
import { debateControversial } from "./scenarios/debate-controversial";
import { withSpan, logInfo, countMetric } from "@/lib/telemetry";

const SCENARIOS: Record<string, ScenarioConfig> = {
  "brainstorming-average": brainstormingAverage,
  "brainstorming-difficult-full": brainstormingDifficultFull,
  "brainstorming-difficult-variety": brainstormingDifficultVariety,
  "debate-controversial": debateControversial,
};

export function getScenario(id: string): ScenarioConfig | undefined {
  return withSpan("scenarioLibrary.getScenario", "evaluation.experiment", () => {
    const scenario = SCENARIOS[id];
    if (scenario) {
      logInfo("scenario loaded", { id });
      countMetric("evaluation.experiment.scenario.loaded", 1, { id });
    }
    return scenario;
  });
}

export function listScenarios(): ScenarioConfig[] {
  return withSpan("scenarioLibrary.listScenarios", "evaluation.experiment", () => {
    const scenarios = Object.values(SCENARIOS);
    logInfo("scenarios listed", { count: scenarios.length });
    return scenarios;
  });
}

export function getScenarioIds(): string[] {
  return Object.keys(SCENARIOS);
}
