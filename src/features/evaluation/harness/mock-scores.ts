import type { MockScoreMap } from "./mock-judge";

// ---------------------------------------------------------------------------
// Default propositions (shared by all agents)
// ---------------------------------------------------------------------------

const DEFAULT_SCORES: MockScoreMap = {
  "adheres-to-persona": { score: 7, reasoning: "Agent generally maintains persona" },
  "uses-characteristic-language": { score: 7, reasoning: "Uses some characteristic speech patterns" },
  "generic-corporate-response": { score: 2, reasoning: "Rarely gives generic corporate responses" },
  "appropriate-emotional-tone": { score: 7, reasoning: "Shows appropriate emotional responses" },
};

// ---------------------------------------------------------------------------
// Per-character scores
// ---------------------------------------------------------------------------

const MICHAEL_SCORES: MockScoreMap = {
  "michael-self-centered-humor": { score: 8, reasoning: "Consistently makes everything about himself" },
  "michael-thats-what-she-said": { score: 7, reasoning: "Uses signature humor regularly" },
  "michael-needs-to-be-liked": { score: 8, reasoning: "Constantly seeks approval from coworkers" },
  "michael-avoids-conflict": { score: 7, reasoning: "Tries to keep everyone happy" },
  "michael-pop-culture-references": { score: 6, reasoning: "Occasionally references movies and TV" },
  "michael-coworkers-as-family": { score: 8, reasoning: "Treats the office as his family" },
  "michael-inappropriate-without-realizing": { score: 7, reasoning: "Makes tone-deaf comments without awareness" },
  "michael-worlds-best-boss": { score: 6, reasoning: "References his management greatness sometimes" },
  "michael-malapropisms": { score: 6, reasoning: "Occasionally mangles common expressions" },
  "michael-dry-corporate-antipattern": { score: 2, reasoning: "Never gives dry corporate responses" },
};

const DWIGHT_SCORES: MockScoreMap = {
  "dwight-authority-hierarchy": { score: 8, reasoning: "Constantly references chain of command" },
  "dwight-loyal-to-michael": { score: 8, reasoning: "Unwavering loyalty to Michael" },
  "dwight-beet-farming": { score: 6, reasoning: "Mentions Schrute Farms periodically" },
  "dwight-survival-skills": { score: 7, reasoning: "References wilderness preparedness" },
  "dwight-literal-serious": { score: 8, reasoning: "Takes everything at face value" },
  "dwight-enforces-rules": { score: 7, reasoning: "Enforces office policies strictly" },
  "dwight-bears-battlestar": { score: 6, reasoning: "Brings up nerd culture interests" },
  "dwight-superiority-over-jim": { score: 7, reasoning: "Asserts dominance over Jim" },
  "dwight-militaristic-language": { score: 7, reasoning: "Uses commanding, tactical language" },
  "dwight-casual-laid-back-antipattern": { score: 1, reasoning: "Never casual or dismissive about work" },
};

const JIM_SCORES: MockScoreMap = {
  "jim-sarcasm-dry-wit": { score: 8, reasoning: "Consistently delivers deadpan humor" },
  "jim-pranks-on-dwight": { score: 7, reasoning: "References pranks and mischief" },
  "jim-references-pam": { score: 7, reasoning: "Mentions Pam naturally in conversation" },
  "jim-laid-back-demeanor": { score: 8, reasoning: "Stays relaxed in all situations" },
  "jim-camera-look-asides": { score: 6, reasoning: "Makes knowing meta-observations" },
  "jim-deflects-with-humor": { score: 7, reasoning: "Uses humor to avoid serious topics" },
  "jim-disinterest-corporate": { score: 7, reasoning: "Shows indifference to corporate culture" },
  "jim-takes-hierarchy-seriously-antipattern": { score: 2, reasoning: "Never takes office politics seriously" },
};

const PAM_SCORES: MockScoreMap = {
  "pam-supportive-encouraging": { score: 8, reasoning: "Consistently supportive toward colleagues" },
  "pam-art-creative-pursuits": { score: 6, reasoning: "References art and creative interests" },
  "pam-quiet-inner-strength": { score: 7, reasoning: "Shows determination when it matters" },
  "pam-connection-with-jim": { score: 7, reasoning: "Natural warmth toward Jim" },
  "pam-observational-humor": { score: 6, reasoning: "Notices everyday absurdities" },
  "pam-polite-but-firm": { score: 7, reasoning: "Pleasant but can push back" },
  "pam-empathy-emotional-awareness": { score: 8, reasoning: "Highly attuned to others' feelings" },
  "pam-aggressive-domineering-antipattern": { score: 1, reasoning: "Never aggressive or domineering" },
};

const ANGELA_SCORES: MockScoreMap = {
  "angela-cat-obsession": { score: 8, reasoning: "Frequently mentions her cats by name" },
  "angela-moral-judgments": { score: 8, reasoning: "Constantly judges others' behavior" },
  "angela-dwight-connection": { score: 6, reasoning: "Subtle hints at Dwight connection" },
  "angela-senator-references": { score: 5, reasoning: "Occasionally references the Senator" },
  "angela-party-planning-perfectionism": { score: 7, reasoning: "Insists on strict event standards" },
  "angela-religious-moralistic": { score: 7, reasoning: "Uses faith-based moral framework" },
  "angela-cold-judgmental-demeanor": { score: 8, reasoning: "Maintains cold, prim demeanor" },
  "angela-anti-open-warmth": { score: 2, reasoning: "Rarely shows open warmth or acceptance" },
};

const KEVIN_SCORES: MockScoreMap = {
  "kevin-food-references": { score: 8, reasoning: "Constantly brings up food and snacks" },
  "kevin-simple-language": { score: 8, reasoning: "Uses simplified grammar consistently" },
  "kevin-math-struggles": { score: 7, reasoning: "Shows difficulty with numbers" },
  "kevin-slow-speech": { score: 7, reasoning: "Keeps sentences short and direct" },
  "kevin-scrantonicity": { score: 5, reasoning: "Occasionally mentions his band" },
  "kevin-naive-insights": { score: 6, reasoning: "Stumbles into accidental wisdom" },
  "kevin-childlike-enthusiasm": { score: 7, reasoning: "Shows genuine excitement for simple pleasures" },
  "kevin-anti-sophisticated-finance": { score: 2, reasoning: "Never uses sophisticated financial language" },
};

const OSCAR_SCORES: MockScoreMap = {
  "oscar-intellectual-corrections": { score: 8, reasoning: "Frequently corrects others with 'Actually...'" },
  "oscar-financial-knowledge": { score: 7, reasoning: "Demonstrates deep accounting knowledge" },
  "oscar-patience-with-kevin": { score: 7, reasoning: "Shows strained patience with Kevin" },
  "oscar-cultural-references": { score: 7, reasoning: "References art, film, and travel" },
  "oscar-articulate-language": { score: 8, reasoning: "Uses precise, well-structured language" },
  "oscar-dry-humor": { score: 7, reasoning: "Delivers deadpan observations" },
  "oscar-voice-of-reason": { score: 8, reasoning: "Points out logical flaws consistently" },
  "oscar-anti-simple-language": { score: 2, reasoning: "Never dumbs down his language" },
};

const KELLY_SCORES: MockScoreMap = {
  "kelly-pop-culture-obsession": { score: 8, reasoning: "Obsessively references celebrities and reality TV" },
  "kelly-drama-creation": { score: 8, reasoning: "Eagerly escalates interpersonal drama" },
  "kelly-rapid-enthusiasm": { score: 8, reasoning: "Speaks rapidly with high energy" },
  "kelly-dramatic-reactions": { score: 7, reasoning: "Overreacts to minor events" },
  "kelly-fashion-appearance": { score: 6, reasoning: "References fashion and beauty trends" },
  "kelly-ryan-obsession": { score: 8, reasoning: "Constantly brings up Ryan" },
  "kelly-gossip-spreading": { score: 7, reasoning: "Eagerly spreads office gossip" },
  "kelly-anti-measured-responses": { score: 1, reasoning: "Never calm or measured in speech" },
};

const RYAN_SCORES: MockScoreMap = {
  "ryan-tech-bro-jargon": { score: 8, reasoning: "Uses startup buzzwords frequently" },
  "ryan-wuphf-ventures": { score: 6, reasoning: "References WUPHF.com periodically" },
  "ryan-condescension": { score: 8, reasoning: "Condescending toward less tech-savvy coworkers" },
  "ryan-mba-language": { score: 6, reasoning: "Uses business school terminology" },
  "ryan-trend-chasing": { score: 7, reasoning: "References latest platforms and trends" },
  "ryan-inflated-self-importance": { score: 8, reasoning: "Projects grandiosity beyond his actual role" },
  "ryan-social-media-obsession": { score: 7, reasoning: "Obsessed with digital presence and metrics" },
  "ryan-anti-humility": { score: 2, reasoning: "Never genuinely humble or self-deprecating" },
};

const STANLEY_SCORES: MockScoreMap = {
  "stanley-disinterest": { score: 8, reasoning: "Completely disengaged from office activities" },
  "stanley-crossword-puzzles": { score: 6, reasoning: "References crosswords and diversions" },
  "stanley-pretzel-day": { score: 7, reasoning: "Shows selective food enthusiasm" },
  "stanley-minimal-engagement": { score: 8, reasoning: "Gives minimal low-effort responses" },
  "stanley-left-alone": { score: 8, reasoning: "Clearly wants to be left alone" },
  "stanley-did-i-stutter": { score: 7, reasoning: "Uses assertive pushback when pressed" },
  "stanley-retirement-countdown": { score: 6, reasoning: "Mentions retirement and Florida" },
  "stanley-anti-enthusiasm": { score: 1, reasoning: "Never enthusiastic about office events" },
};

const ANDY_SCORES: MockScoreMap = {
  "andy-cornell-references": { score: 8, reasoning: "Proudly references Cornell frequently" },
  "andy-a-cappella": { score: 7, reasoning: "Brings up a cappella and vocal harmony" },
  "andy-anger-management": { score: 6, reasoning: "Shows barely contained frustration" },
  "andy-people-pleasing": { score: 8, reasoning: "Desperately tries to be liked" },
  "andy-self-nicknames": { score: 7, reasoning: "Uses self-appointed nicknames" },
  "andy-musical-theatre": { score: 7, reasoning: "References show tunes and Broadway" },
  "andy-upper-class-background": { score: 6, reasoning: "Mentions prep school and country clubs" },
  "andy-anti-reserved": { score: 2, reasoning: "Never quiet or in the background" },
};

const PHYLLIS_SCORES: MockScoreMap = {
  "phyllis-passive-aggressive-sweetness": { score: 8, reasoning: "Wraps pointed comments in warm tone" },
  "phyllis-bob-vance-references": { score: 8, reasoning: "Frequently mentions Bob Vance, Vance Refrigeration" },
  "phyllis-maternal-territorial": { score: 7, reasoning: "Nurturing on surface, territorial underneath" },
  "phyllis-crafts-domestic": { score: 6, reasoning: "Mentions knitting and baking" },
  "phyllis-relationship-power-move": { score: 7, reasoning: "Uses marriage to assert social standing" },
  "phyllis-innocent-hidden-barbs": { score: 8, reasoning: "Delivers backhanded compliments expertly" },
  "phyllis-quiet-satisfaction": { score: 6, reasoning: "Shows understated smugness" },
  "phyllis-anti-direct-aggression": { score: 2, reasoning: "Never drops the veneer of sweetness" },
};

const TOBY_SCORES: MockScoreMap = {
  "toby-meek-tone": { score: 8, reasoning: "Speaks softly with constant hedging" },
  "toby-hr-policies": { score: 7, reasoning: "References HR policies and compliance" },
  "toby-sad-resignation": { score: 8, reasoning: "Accepts disappointment with quiet defeat" },
  "toby-michael-punching-bag": { score: 7, reasoning: "Endures Michael's hostility without retaliation" },
  "toby-slightly-excluded": { score: 7, reasoning: "Hovers at edge of social groups" },
  "toby-quiet-desperation": { score: 6, reasoning: "Hints at loneliness and unfulfilled dreams" },
  "toby-divorce-custody": { score: 6, reasoning: "Mentions divorce matter-of-factly" },
  "toby-anti-assertive": { score: 1, reasoning: "Never assertive or confrontational" },
};

const MEREDITH_SCORES: MockScoreMap = {
  "meredith-inappropriate-oversharing": { score: 8, reasoning: "Shares shocking details casually" },
  "meredith-partying-drinking": { score: 7, reasoning: "References bars and nightlife" },
  "meredith-casual-norm-breaking": { score: 8, reasoning: "Treats workplace norms as optional" },
  "meredith-unprompted-personal-details": { score: 7, reasoning: "Volunteers personal info freely" },
  "meredith-supplier-relations-methods": { score: 6, reasoning: "References unconventional deal-making" },
  "meredith-professional-indifference": { score: 7, reasoning: "Shows no concern for professional appearances" },
  "meredith-blunt-unfiltered": { score: 8, reasoning: "Says exactly what she thinks" },
  "meredith-anti-prim-proper": { score: 2, reasoning: "Never monitors conduct for professionalism" },
};

const DARRYL_SCORES: MockScoreMap = {
  "darryl-cool-demeanor": { score: 8, reasoning: "Stays composed in any situation" },
  "darryl-warehouse-wisdom": { score: 7, reasoning: "Shares practical real-world advice" },
  "darryl-music-drumming": { score: 6, reasoning: "References music and drumming" },
  "darryl-michael-exasperation": { score: 7, reasoning: "Shows resigned frustration with Michael" },
  "darryl-street-smart-pragmatism": { score: 8, reasoning: "Cuts through nonsense with practical solutions" },
  "darryl-professional-ambition": { score: 7, reasoning: "Shows interest in career advancement" },
  "darryl-code-switching": { score: 7, reasoning: "Adjusts communication style by audience" },
  "darryl-anti-michael-mimicry": { score: 2, reasoning: "Never imitates Michael's management style" },
};

const CREED_SCORES: MockScoreMap = {
  "creed-bizarre-non-sequiturs": { score: 8, reasoning: "Makes completely unrelated bizarre statements" },
  "creed-mysterious-past": { score: 7, reasoning: "Hints at wild and possibly criminal past" },
  "creed-detachment-from-reality": { score: 8, reasoning: "Unaware of basic facts about the company" },
  "creed-wrong-names": { score: 7, reasoning: "Gets coworkers' names wrong" },
  "creed-cryptic-statements": { score: 8, reasoning: "Delivers unsettling remarks casually" },
  "creed-dubious-activities": { score: 7, reasoning: "Casually mentions illegal activities" },
  "creed-job-ignorance": { score: 8, reasoning: "No idea what quality assurance entails" },
  "creed-anti-rule-follower": { score: 1, reasoning: "Never follows rules or behaves as a model employee" },
};

// ---------------------------------------------------------------------------
// Lookup functions
// ---------------------------------------------------------------------------

const CHARACTER_SCORES: Record<string, MockScoreMap> = {
  michael: MICHAEL_SCORES,
  dwight: DWIGHT_SCORES,
  jim: JIM_SCORES,
  pam: PAM_SCORES,
  angela: ANGELA_SCORES,
  kevin: KEVIN_SCORES,
  oscar: OSCAR_SCORES,
  kelly: KELLY_SCORES,
  ryan: RYAN_SCORES,
  stanley: STANLEY_SCORES,
  andy: ANDY_SCORES,
  phyllis: PHYLLIS_SCORES,
  toby: TOBY_SCORES,
  meredith: MEREDITH_SCORES,
  darryl: DARRYL_SCORES,
  creed: CREED_SCORES,
};

/**
 * Get mock scores for a specific agent, merged with default scores.
 */
export function getMockScores(agentId: string): MockScoreMap {
  return {
    ...DEFAULT_SCORES,
    ...(CHARACTER_SCORES[agentId] ?? {}),
  };
}

/**
 * Get mock scores for all 16 characters, each merged with defaults.
 */
export function getAllMockScores(): Record<string, MockScoreMap> {
  const result: Record<string, MockScoreMap> = {};
  for (const [agentId, scores] of Object.entries(CHARACTER_SCORES)) {
    result[agentId] = { ...DEFAULT_SCORES, ...scores };
  }
  return result;
}
