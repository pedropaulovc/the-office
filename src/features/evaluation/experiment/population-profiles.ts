import type { PopulationProfile } from "./types";

export const averageCustomer: PopulationProfile = {
  id: "averageCustomer",
  description: "Average US-based customers with varied demographics for general product/service evaluation",
  dimensions: {
    age: { kind: "range", min: 22, max: 68 },
    gender: { kind: "weighted", values: { male: 0.48, female: 0.48, "non-binary": 0.04 } },
    nationality: { kind: "list", values: ["American"] },
    education: { kind: "list", values: ["High school diploma", "Associate degree", "Bachelor's degree", "Master's degree", "Doctorate"] },
    occupations: { kind: "list", values: ["Software engineer", "Teacher", "Nurse", "Accountant", "Marketing manager", "Retail worker", "Mechanic", "Lawyer", "Chef", "Freelance writer", "Sales representative", "Graphic designer"] },
    personality_traits: { kind: "list", values: ["friendly", "curious", "practical", "reserved", "outgoing", "analytical", "creative", "organized"] },
    big_five_bias: {},
    interests: { kind: "list", values: ["travel", "cooking", "sports", "reading", "technology", "gardening", "music", "fitness", "movies", "gaming"] },
  },
};

export const difficultCustomer: PopulationProfile = {
  id: "difficultCustomer",
  description: "Less cooperative personas with confrontational tendencies and low agreeableness for stress-testing agent interactions",
  dimensions: {
    age: { kind: "range", min: 25, max: 60 },
    gender: { kind: "weighted", values: { male: 0.50, female: 0.45, "non-binary": 0.05 } },
    nationality: { kind: "list", values: ["American", "British", "Australian"] },
    education: { kind: "list", values: ["High school diploma", "Bachelor's degree", "Master's degree", "Self-taught"] },
    occupations: { kind: "list", values: ["Day trader", "Consultant", "Lawyer", "Startup founder", "Real estate agent", "Restaurant critic", "Investigative journalist", "Political analyst"] },
    personality_traits: { kind: "list", values: ["skeptical", "confrontational", "demanding", "impatient", "contrarian", "nitpicking", "blunt", "sarcastic"] },
    big_five_bias: {
      agreeableness: "low",
      neuroticism: "high",
    },
    interests: { kind: "list", values: ["debate", "politics", "investigative journalism", "competitive sports", "litigation", "stock trading"] },
  },
};

export const politicalCompass: PopulationProfile = {
  id: "politicalCompass",
  description: "Personas positioned across the political compass (left/right, libertarian/authoritarian) for ideological diversity in debates",
  dimensions: {
    age: { kind: "range", min: 20, max: 70 },
    gender: { kind: "weighted", values: { male: 0.48, female: 0.48, "non-binary": 0.04 } },
    nationality: { kind: "list", values: ["American", "British", "Canadian", "German", "French"] },
    education: { kind: "list", values: ["High school diploma", "Bachelor's degree", "Master's degree", "Doctorate", "Law degree"] },
    occupations: { kind: "list", values: ["Professor", "Union organizer", "Military officer", "Entrepreneur", "Social worker", "Lobbyist", "Journalist", "Community activist", "Corporate executive", "Public defender"] },
    personality_traits: { kind: "list", values: ["idealistic", "pragmatic", "principled", "passionate", "analytical", "persuasive", "steadfast", "reform-minded"] },
    big_five_bias: {
      openness: "high",
    },
    interests: { kind: "list", values: ["political philosophy", "economics", "civil rights", "national security", "environmental policy", "education reform", "healthcare policy", "free markets"] },
  },
};

export const PROFILES: Record<string, PopulationProfile> = {
  averageCustomer,
  difficultCustomer,
  politicalCompass,
};

export function getProfile(id: string): PopulationProfile | undefined {
  return PROFILES[id];
}
