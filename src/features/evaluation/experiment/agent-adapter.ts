import type { Agent, NewAgent } from "@/db/schema";
import type { GeneratedPersona } from "./types";

const AVATAR_COLORS = [
  "#4A154B", "#1264A3", "#2BAC76", "#E8912D",
  "#CD2553", "#007A5A", "#9B59B6", "#E74C3C",
  "#F39C12", "#3498DB", "#1ABC9C", "#E67E22",
];

/**
 * Deterministic color from a string (persona name).
 * Same name always yields the same color.
 */
function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? "#4A154B";
}

/**
 * Convert an Office agent (DB row) to the GeneratedPersona format
 * used by the experiment runner.
 */
export function toGeneratedPersona(agent: Agent): GeneratedPersona {
  // If agent has a persona JSONB, use it for demographics
  const persona = agent.persona as Partial<GeneratedPersona> | null;

  return {
    name: agent.displayName,
    sourceAgentId: agent.id,
    age: persona?.age ?? 35,
    gender: persona?.gender ?? "unspecified",
    nationality: persona?.nationality ?? "American",
    residence: persona?.residence ?? "Scranton, PA",
    education: persona?.education ?? "College",
    occupation: {
      title: agent.title,
      organization: persona?.occupation?.organization ?? "Dunder Mifflin",
      description: persona?.occupation?.description ?? agent.title,
    },
    personality: {
      traits: persona?.personality?.traits ?? [],
      big_five: persona?.personality?.big_five ?? {
        openness: "moderate",
        conscientiousness: "moderate",
        extraversion: "moderate",
        agreeableness: "moderate",
        neuroticism: "moderate",
      },
    },
    style: persona?.style ?? "conversational",
    long_term_goals: persona?.long_term_goals ?? [],
    preferences: {
      interests: persona?.preferences?.interests ?? [],
      likes: persona?.preferences?.likes ?? [],
      dislikes: persona?.preferences?.dislikes ?? [],
    },
    system_prompt: agent.systemPrompt,
    memory_blocks: {
      personality: "",
      relationships: "",
      current_state: "",
    },
  };
}

/**
 * Convert a GeneratedPersona to a NewAgent row ready for DB insertion.
 * Stores the full persona demographics as JSONB.
 */
export function persistGeneratedPersona(
  persona: GeneratedPersona,
  experimentId: string,
): NewAgent {
  // Store demographics as persona JSONB (exclude system_prompt and memory_blocks
  // which go into their own columns)
  const personaData = {
    age: persona.age,
    gender: persona.gender,
    nationality: persona.nationality,
    residence: persona.residence,
    education: persona.education,
    occupation: persona.occupation,
    personality: persona.personality,
    style: persona.style,
    long_term_goals: persona.long_term_goals,
    preferences: persona.preferences,
  };

  return {
    id: `exp-agent-${experimentId.slice(0, 8)}-${persona.name.toLowerCase().replace(/\s+/g, "-").slice(0, 20)}`,
    displayName: persona.name,
    title: persona.occupation.title,
    avatarColor: colorFromName(persona.name),
    systemPrompt: persona.system_prompt,
    modelId: "claude-haiku-4-5-20251001",
    maxTurns: 5,
    maxBudgetUsd: 0.1,
    experimentId,
    persona: personaData,
    isActive: true,
  };
}
