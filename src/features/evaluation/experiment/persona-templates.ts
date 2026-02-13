import type { GeneratedPersona } from "./types";

/**
 * Generates a system prompt from persona fields, following the structure
 * of the 16 Office character system prompts.
 */
export function generateSystemPrompt(persona: Omit<GeneratedPersona, "system_prompt" | "memory_blocks">): string {
  const lines: string[] = [];

  lines.push(`You are ${persona.name}, a ${persona.age}-year-old ${persona.gender} from ${persona.residence}.`);
  lines.push("");

  lines.push("## Background");
  lines.push(`- **Education**: ${persona.education}`);
  lines.push(`- **Occupation**: ${persona.occupation.title} at ${persona.occupation.organization}`);
  lines.push(`- ${persona.occupation.description}`);
  lines.push("");

  lines.push("## Personality");
  lines.push(`- **Traits**: ${persona.personality.traits.join(", ")}`);
  lines.push(`- **Openness**: ${persona.personality.big_five.openness}`);
  lines.push(`- **Conscientiousness**: ${persona.personality.big_five.conscientiousness}`);
  lines.push(`- **Extraversion**: ${persona.personality.big_five.extraversion}`);
  lines.push(`- **Agreeableness**: ${persona.personality.big_five.agreeableness}`);
  lines.push(`- **Neuroticism**: ${persona.personality.big_five.neuroticism}`);
  lines.push("");

  lines.push("## Communication Style");
  lines.push(persona.style);
  lines.push("");

  lines.push("## Goals");
  for (const goal of persona.long_term_goals) {
    lines.push(`- ${goal}`);
  }
  lines.push("");

  lines.push("## Preferences");
  lines.push(`- **Interests**: ${persona.preferences.interests.join(", ")}`);
  lines.push(`- **Likes**: ${persona.preferences.likes.join(", ")}`);
  lines.push(`- **Dislikes**: ${persona.preferences.dislikes.join(", ")}`);

  return lines.join("\n");
}

/**
 * Generates initial memory blocks from persona fields.
 */
export function generateMemoryBlocks(
  persona: Omit<GeneratedPersona, "system_prompt" | "memory_blocks">,
): GeneratedPersona["memory_blocks"] {
  const personality = [
    `${persona.name} is ${persona.personality.traits.slice(0, 3).join(", ")}.`,
    `They are a ${persona.occupation.title} who values ${persona.preferences.likes.slice(0, 2).join(" and ")}.`,
    `Communication style: ${persona.style.slice(0, 100)}.`,
  ].join(" ");

  const relationships = `${persona.name} is a new participant with no established relationships yet.`;

  const current_state = [
    `${persona.name} is ready to participate in the conversation.`,
    `Current mood: neutral. Goals: ${persona.long_term_goals[0] ?? "engage meaningfully"}.`,
  ].join(" ");

  return { personality, relationships, current_state };
}
