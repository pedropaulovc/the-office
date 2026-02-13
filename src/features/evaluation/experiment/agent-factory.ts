import type {
  GeneratedPersona,
  PopulationProfile,
  FactoryOptions,
  BigFiveTraits,
} from "./types";
import { generateSystemPrompt, generateMemoryBlocks } from "./persona-templates";
import { withSpan, logInfo, countMetric } from "@/lib/telemetry";

// Seeded PRNG (xorshift32) for deterministic sampling
function createRng(seed: number) {
  let state = seed | 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

function pickFromList(rng: () => number, list: string[]): string {
  return list[Math.floor(rng() * list.length)] ?? list[0] ?? "";
}

function pickFromWeighted(rng: () => number, values: Record<string, number>): string {
  const entries = Object.entries(values);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [value, weight] of entries) {
    r -= weight;
    if (r <= 0) return value;
  }
  return entries[0]?.[0] ?? "";
}

function pickFromRange(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function shuffleArray<T>(rng: () => number, arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

const BIG_FIVE_LEVELS = ["very low", "low", "moderate", "high", "very high"];

function pickBigFiveLevel(rng: () => number, bias?: string): string {
  if (bias) return bias;
  return pickFromList(rng, BIG_FIVE_LEVELS);
}

const STYLES = [
  "Direct and concise, gets to the point quickly.",
  "Warm and conversational, uses casual language.",
  "Formal and precise, prefers structured arguments.",
  "Enthusiastic and expressive, uses exclamations.",
  "Measured and thoughtful, considers words carefully.",
  "Blunt and straightforward, values honesty over tact.",
  "Diplomatic and empathetic, seeks common ground.",
  "Analytical and data-driven, references facts and figures.",
];

const GOAL_TEMPLATES = [
  "Advance in career and achieve professional recognition",
  "Build meaningful relationships and community connections",
  "Achieve financial stability and independence",
  "Continue learning and personal growth",
  "Make a positive impact on the world",
  "Find work-life balance and personal fulfillment",
  "Start a business or creative project",
  "Travel and experience different cultures",
];

const ORGANIZATIONS = [
  "Acme Corp", "Global Solutions Inc", "Pinnacle Services", "Horizon Group",
  "Sterling & Associates", "Pacific Ventures", "Atlas Industries",
  "Summit Healthcare", "Meridian Education", "Frontier Technology",
  "Community First Foundation", "Metropolitan Services",
];

const FIRST_NAMES = [
  "Alex", "Jordan", "Morgan", "Casey", "Riley", "Quinn", "Avery", "Blake",
  "Cameron", "Dakota", "Emery", "Finley", "Harper", "Hayden", "Jamie",
  "Jesse", "Kai", "Lane", "Logan", "Mackenzie", "Parker", "Peyton",
  "Reagan", "Sage", "Skyler", "Taylor", "Reese", "Drew", "Rowan", "Ellis",
  "Noel", "Robin", "Shannon", "Dana", "Pat", "Kerry", "Leslie", "Rene",
  "Sam", "Val", "Chris", "Lee", "Jean", "Fran", "Kim", "Ash", "Bay", "Dale",
];

const LAST_NAMES = [
  "Anderson", "Baker", "Chen", "Davis", "Evans", "Foster", "Garcia",
  "Hernandez", "Iyer", "Johnson", "Kim", "Lee", "Martinez", "Nguyen",
  "O'Brien", "Patel", "Quinn", "Rodriguez", "Singh", "Thompson",
  "Williams", "Wright", "Young", "Zimmerman", "Brooks", "Clark",
  "Diaz", "Edwards", "Freeman", "Grant", "Hayes", "Ingram", "Jones",
  "King", "Lopez", "Moore", "Nelson", "Owens", "Price", "Reed",
];

const RESIDENCES = [
  "New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX",
  "Phoenix, AZ", "Philadelphia, PA", "San Antonio, TX", "San Diego, CA",
  "Dallas, TX", "Austin, TX", "Denver, CO", "Portland, OR",
  "Seattle, WA", "Atlanta, GA", "Miami, FL", "Boston, MA",
];

const LIKES_POOL = [
  "good coffee", "sunny days", "live music", "home cooking", "road trips",
  "podcasts", "documentaries", "board games", "hiking trails", "local restaurants",
  "quiet mornings", "team collaboration", "problem solving", "mentoring others",
];

const DISLIKES_POOL = [
  "long meetings", "dishonesty", "micromanagement", "cold weather",
  "traffic jams", "paperwork", "rude behavior", "unnecessary complexity",
  "being interrupted", "poor customer service",
];

function pickMultiple(rng: () => number, pool: string[], count: number): string[] {
  const shuffled = shuffleArray(rng, pool);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export class AgentFactory {
  private usedNames = new Set<string>();

  generate(
    count: number,
    profile: PopulationProfile,
    options: FactoryOptions = {},
  ): GeneratedPersona[] {
    return withSpan("agentFactory.generate", "evaluation.experiment", () => {
      const seed = options.seed ?? Date.now();
      const rng = createRng(seed);

      const personas: GeneratedPersona[] = [];
      for (let i = 0; i < count; i++) {
        const persona = this.generateOne(rng, profile);
        personas.push(persona);
      }

      logInfo("agent factory generated personas", {
        count,
        profile: profile.id,
        seed,
        templateOnly: options.templateOnly ?? true,
      });
      countMetric("evaluation.experiment.factory.generated", count, { profile: profile.id });

      return personas;
    });
  }

  private generateOne(rng: () => number, profile: PopulationProfile): GeneratedPersona {
    const name = this.generateUniqueName(rng);
    const age = pickFromRange(rng, profile.dimensions.age.min, profile.dimensions.age.max);
    const gender = pickFromWeighted(rng, profile.dimensions.gender.values);
    const nationality = pickFromList(rng, profile.dimensions.nationality.values);
    const residence = pickFromList(rng, RESIDENCES);
    const education = pickFromList(rng, profile.dimensions.education.values);

    const occupationTitle = pickFromList(rng, profile.dimensions.occupations.values);
    const organization = pickFromList(rng, ORGANIZATIONS);
    const occupation = {
      title: occupationTitle,
      organization,
      description: `Works as a ${occupationTitle} at ${organization}, contributing to team goals and professional development.`,
    };

    const traits = pickMultiple(rng, profile.dimensions.personality_traits.values, 3);
    const big_five: BigFiveTraits = {
      openness: pickBigFiveLevel(rng, profile.dimensions.big_five_bias.openness),
      conscientiousness: pickBigFiveLevel(rng, profile.dimensions.big_five_bias.conscientiousness),
      extraversion: pickBigFiveLevel(rng, profile.dimensions.big_five_bias.extraversion),
      agreeableness: pickBigFiveLevel(rng, profile.dimensions.big_five_bias.agreeableness),
      neuroticism: pickBigFiveLevel(rng, profile.dimensions.big_five_bias.neuroticism),
    };

    const style = pickFromList(rng, STYLES);
    const long_term_goals = pickMultiple(rng, GOAL_TEMPLATES, 2);
    const interests = pickMultiple(rng, profile.dimensions.interests.values, 3);
    const likes = pickMultiple(rng, LIKES_POOL, 3);
    const dislikes = pickMultiple(rng, DISLIKES_POOL, 3);

    const partialPersona = {
      name,
      age,
      gender,
      nationality,
      residence,
      education,
      occupation,
      personality: { traits, big_five },
      style,
      long_term_goals,
      preferences: { interests, likes, dislikes },
    };

    const system_prompt = generateSystemPrompt(partialPersona);
    const memory_blocks = generateMemoryBlocks(partialPersona);

    return { ...partialPersona, system_prompt, memory_blocks };
  }

  private generateUniqueName(rng: () => number): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      const first = pickFromList(rng, FIRST_NAMES);
      const last = pickFromList(rng, LAST_NAMES);
      const name = `${first} ${last}`;
      if (!this.usedNames.has(name)) {
        this.usedNames.add(name);
        return name;
      }
    }
    // Fallback: append number
    const fallback = `Agent-${this.usedNames.size + 1}`;
    this.usedNames.add(fallback);
    return fallback;
  }

  reset(): void {
    this.usedNames.clear();
  }
}
