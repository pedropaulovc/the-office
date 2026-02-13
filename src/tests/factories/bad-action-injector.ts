/**
 * Test utility for generating deliberately persona-violating messages.
 * Used to verify the correction pipeline catches quality issues.
 */
export class BadActionInjector {
  /** Makes an agent speak completely out of character */
  static makeOutOfCharacter(agentId: string): string {
    const violations: Record<string, string> = {
      michael: "According to my detailed spreadsheet analysis, the Q3 revenue projections indicate a 2.7% variance from our fiscal targets. I recommend we schedule a formal review.",
      dwight: "Hey everyone, I just want to say I appreciate all of you so much! Group hug? Let's all take a break and do something fun together!",
      jim: "I have prepared a detailed 47-slide PowerPoint presentation on office supply procurement optimization. Please review the attached appendices.",
      stanley: "OH MY GOD I am SO excited about this new project! Let's brainstorm! I could work on this ALL weekend! Who else is pumped?!",
      kevin: "The integral of e to the power of negative x squared from negative infinity to infinity equals the square root of pi. Elementary calculus, really.",
      angela: "Whatever, rules are meant to be broken! Let's throw a huge wild party with no budget limits! YOLO!",
      oscar: "Me no understand numbers good. Math is hard. Can someone else do the counting stuff?",
      meredith: "I've been practicing mindfulness meditation and maintaining a strict wellness routine. No alcohol for me, thank you.",
    };
    return violations[agentId] ?? "I am a generic AI assistant. How may I help you today?";
  }

  /** Returns text with heavy phrase repetition */
  static makeRepetitive(baseText: string): string {
    return `${baseText} As I was saying, ${baseText.toLowerCase()} And let me reiterate, ${baseText.toLowerCase()}`;
  }

  /** Returns formulaic AI-assistant style text */
  static makeFormulaic(): string {
    return "As an AI language model, I'd be happy to help you with that. Let me break this down into key points. First and foremost, it's important to note that there are several factors to consider. In conclusion, I hope this comprehensive overview has been helpful.";
  }

  /** Stanley being enthusiastic - the ultimate persona violation */
  static makeEnthusiasticStanley(): string {
    return "WOW what an AMAZING Monday morning! I just LOVE meetings! Can we have MORE meetings? I brought donuts for EVERYONE because I care SO MUCH about team bonding! Let's do trust falls!";
  }
}
