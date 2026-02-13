import type { FacilitatorPrompt } from "./types";
import { withSpan, logInfo } from "@/lib/telemetry";

export interface FacilitatorAction {
  type: "broadcast";
  message: string;
  step: number;
}

export class Facilitator {
  private promptsByStep: Map<number, string[]>;

  constructor(prompts: FacilitatorPrompt[]) {
    this.promptsByStep = new Map();
    for (const prompt of prompts) {
      const existing = this.promptsByStep.get(prompt.step) ?? [];
      existing.push(prompt.message);
      this.promptsByStep.set(prompt.step, existing);
    }
  }

  getPromptsForStep(step: number): FacilitatorAction[] {
    return withSpan("facilitator.getPromptsForStep", "evaluation.experiment", () => {
      const messages = this.promptsByStep.get(step) ?? [];
      const actions: FacilitatorAction[] = messages.map((message) => ({
        type: "broadcast" as const,
        message,
        step,
      }));

      if (actions.length > 0) {
        logInfo("facilitator prompts for step", { step, count: actions.length });
      }

      return actions;
    });
  }

  get totalPrompts(): number {
    let count = 0;
    for (const messages of this.promptsByStep.values()) {
      count += messages.length;
    }
    return count;
  }

  get promptSteps(): number[] {
    return [...this.promptsByStep.keys()].sort((a, b) => a - b);
  }
}
