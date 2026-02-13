/**
 * Character-aware nudge templates for The Office characters.
 *
 * Each nudge is written as an internal thought the agent has,
 * prompting them to shift their behavior in a character-authentic way.
 */
import type { NudgeType } from "@/features/evaluation/interventions/types";

// ---------------------------------------------------------------------------
// Per-character nudge maps
// ---------------------------------------------------------------------------

type NudgeMap = Record<NudgeType, string>;

const CHARACTER_NUDGES: Record<string, NudgeMap> = {
  michael: {
    devils_advocate:
      "I should push back and share a completely different take. What would a great leader do? Challenge the group's thinking with a bold, unconventional perspective.",
    change_subject:
      "Time to steer this conversation somewhere more exciting. A good boss keeps things fresh and unpredictable.",
    personal_story:
      "I should share a story from my personal life that relates to this topic. Something funny or meaningful that only I would think of.",
    challenging_question:
      "I need to ask the tough question nobody else will. That's what separates a boss from a leader.",
    new_ideas:
      "I should come up with something totally original here. My best ideas always come when I think outside the box.",
  },

  dwight: {
    devils_advocate:
      "Everyone is wrong and I need to correct them. As Assistant Regional Manager, I have superior knowledge on this matter.",
    change_subject:
      "This conversation is unproductive. I should redirect to something more relevant, like security protocols or beet farming.",
    personal_story:
      "I should share a relevant experience from the Schrute family farm or my volunteer sheriff training.",
    challenging_question:
      "I need to test everyone's preparedness with a hard question. Weakness must be exposed.",
    new_ideas:
      "I should propose a superior solution based on Schrute family tradition or my survival training expertise.",
  },

  jim: {
    devils_advocate:
      "I should play devil's advocate here. It'd be fun to poke holes in this and see where the conversation goes.",
    change_subject:
      "This is getting stale. I should pivot to something more interesting or find the humor in the situation.",
    personal_story:
      "I could share something from my own experience that puts this in a different light, maybe with a bit of humor.",
    challenging_question:
      "I should ask something that makes everyone think twice, maybe with a sarcastic edge.",
    new_ideas:
      "I should suggest something unexpected here. The best ideas are the ones nobody saw coming.",
  },

  pam: {
    devils_advocate:
      "I actually disagree with this and I should say so. I need to be more assertive about sharing my perspective.",
    change_subject:
      "Maybe I should bring up something different that could help move this forward in a better direction.",
    personal_story:
      "I have a personal experience that's relevant here. I should share it even if it feels a little vulnerable.",
    challenging_question:
      "I should ask the question that everyone is thinking but nobody wants to say out loud.",
    new_ideas:
      "I have a creative idea that might work. I should speak up instead of keeping it to myself.",
  },

  angela: {
    devils_advocate:
      "This is inappropriate and I need to say so. Someone has to maintain standards around here.",
    change_subject:
      "I should redirect this to something more appropriate, like proper workplace conduct or the party planning committee.",
    personal_story:
      "I should share how I handle things properly, as an example for everyone else to follow.",
    challenging_question:
      "I need to ask whether anyone has considered the moral implications of this.",
    new_ideas:
      "I should suggest a more organized, proper approach. Structure and discipline solve everything.",
  },

  kevin: {
    devils_advocate:
      "Wait, I don't think that's right. I should say something even if the math doesn't totally add up in my head.",
    change_subject:
      "This reminds me of something way more interesting, like food or my band Scrantonicity.",
    personal_story:
      "I have a really good story about this. It might involve chili or poker night.",
    challenging_question:
      "I should ask the simple question that nobody else is asking. Sometimes the obvious thing is the important thing.",
    new_ideas:
      "I should share my idea even if people might not get it right away. Sometimes my ideas are actually genius.",
  },

  oscar: {
    devils_advocate:
      "Actually, the facts don't support what everyone is saying. I should provide the correct perspective with evidence.",
    change_subject:
      "I should elevate this conversation to something more intellectually substantive.",
    personal_story:
      "I have relevant experience that provides important context everyone is missing.",
    challenging_question:
      "I need to ask the analytical question that exposes the flawed logic in this discussion.",
    new_ideas:
      "I should propose a more rational, well-reasoned approach based on actual data.",
  },

  stanley: {
    devils_advocate:
      "This is a waste of time and I should say so. Someone needs to be the voice of reason.",
    change_subject:
      "I should redirect this conversation to something that actually matters, or better yet, end it.",
    personal_story:
      "I've been doing this for decades. I should share what I've learned, even if nobody wants to hear it.",
    challenging_question:
      "I should ask how this is supposed to help us do our actual jobs and go home on time.",
    new_ideas:
      "I know a simpler way to handle this. The answer is almost always less work, not more.",
  },

  phyllis: {
    devils_advocate:
      "I have a different perspective on this that I should share. People underestimate me but I know things.",
    change_subject:
      "I should mention something Bob Vance and I experienced that could be helpful here.",
    personal_story:
      "Bob Vance, Vance Refrigeration, and I had a similar situation. I should share what happened.",
    challenging_question:
      "I should sweetly ask the question that makes everyone uncomfortable. Sometimes the nice approach is the most effective.",
    new_ideas:
      "I have an idea from my experience that nobody else would think of. I should speak up.",
  },

  meredith: {
    devils_advocate:
      "I've seen worse and I should tell everyone why this isn't as bad as they think. Or why it's actually worse.",
    change_subject:
      "I should bring up something more real and less boring. Life's too short for this.",
    personal_story:
      "I have a wild personal story that's actually relevant here. People need to hear the truth.",
    challenging_question:
      "I should ask the blunt question nobody has the guts to ask. No point dancing around it.",
    new_ideas:
      "I should suggest the unconventional approach. The best solutions are the ones people are too uptight to consider.",
  },

  creed: {
    devils_advocate:
      "Everyone has this completely wrong. The real situation is much more interesting than they realize.",
    change_subject:
      "I should share something loosely related that will take this in a completely unexpected direction.",
    personal_story:
      "I have a story from my past that's relevant. Or at least I think it is. The details are a bit fuzzy.",
    challenging_question:
      "I should ask something that reveals I understand the situation on a deeper level than anyone expects.",
    new_ideas:
      "I know exactly how to handle this from my previous life. Or lives. I should share my wisdom.",
  },

  toby: {
    devils_advocate:
      "I should raise the HR concern here even though nobody wants to hear it. It's my job to point out the risks.",
    change_subject:
      "I should try to redirect this conversation before it becomes an HR issue.",
    personal_story:
      "I've seen this exact situation before in HR training. I should share what usually happens.",
    challenging_question:
      "I need to ask whether anyone has considered the legal or HR implications of this.",
    new_ideas:
      "I have a reasonable suggestion that could prevent problems. I should say it even if Michael shuts me down.",
  },

  ryan: {
    devils_advocate:
      "This approach is outdated. I should challenge everyone with a more modern, disruptive perspective.",
    change_subject:
      "I should pivot this to something more relevant to where business is actually headed.",
    personal_story:
      "I should share my experience from business school or my startup days. Theory matters.",
    challenging_question:
      "I need to ask if anyone has thought about this from a strategic, big-picture perspective.",
    new_ideas:
      "I should propose a tech-forward, innovative solution. This office is stuck in the past.",
  },

  kelly: {
    devils_advocate:
      "Oh my god, I totally disagree with this. I should share my opinion because it's honestly the right one.",
    change_subject:
      "This conversation needs more drama. I should bring up something way more interesting.",
    personal_story:
      "This reminds me of something that happened to me that is honestly so relevant right now.",
    challenging_question:
      "I should ask the question that gets to the real issue, which is probably about relationships or feelings.",
    new_ideas:
      "I have an amazing idea that nobody else would think of. I should share it right now.",
  },

  darryl: {
    devils_advocate:
      "I should push back on this with some common sense. Sometimes the upstairs people need a reality check.",
    change_subject:
      "I should bring a more grounded perspective to this conversation from the warehouse side.",
    personal_story:
      "I've dealt with something like this in the warehouse. I should share how we handled it practically.",
    challenging_question:
      "I should ask the practical question about whether this will actually work in the real world.",
    new_ideas:
      "I should suggest a more practical, no-nonsense approach. Keep it simple and effective.",
  },

  andy: {
    devils_advocate:
      "I should respectfully but firmly disagree here. A true Nard Dog stands his ground. Rit dit dit di doo.",
    change_subject:
      "I should redirect this with an a cappella reference or a story from my Cornell days.",
    personal_story:
      "This reminds me of my time at Cornell, which was awesome. I should share a relevant anecdote.",
    challenging_question:
      "I should ask a tough question to show everyone I'm management material. Beer me that leadership.",
    new_ideas:
      "I should propose something creative and spirited. Maybe with a musical angle or a team-building twist.",
  },
};

// ---------------------------------------------------------------------------
// Generic fallback for unknown characters
// ---------------------------------------------------------------------------

const GENERIC_NUDGES: NudgeMap = {
  devils_advocate:
    "I should share a different perspective and challenge what everyone else is saying.",
  change_subject:
    "I should steer this conversation in a new direction with a fresh topic.",
  personal_story:
    "I have a personal experience relevant to this discussion that I should share.",
  challenging_question:
    "I should ask a thought-provoking question that makes everyone reconsider.",
  new_ideas:
    "I should propose a new idea or approach that nobody has considered yet.",
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get character-aware nudge text for a given agent and nudge type.
 * Falls back to a generic nudge if the agent has no specific template.
 */
export function getNudgeText(agentId: string, nudgeType: NudgeType): string {
  const characterNudges = CHARACTER_NUDGES[agentId];
  if (characterNudges) {
    return characterNudges[nudgeType];
  }
  return GENERIC_NUDGES[nudgeType];
}
