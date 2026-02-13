import { config } from "dotenv";
config({ path: ".env.local" });

import { users, SWITCHABLE_USER_IDS } from "../data/users";
import { systemPrompts } from "../data/system-prompts";
import { memoryBlockData } from "../data/memory-blocks";
import type { NewAgent } from "./schema";

// --- Timestamp helper (relative to "today", matching original mock data) ---

function t(daysAgo: number, hour: number, min: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, min, 0, 0);
  return d;
}

// --- Agent rows ---

const agentRows: NewAgent[] = SWITCHABLE_USER_IDS.map((id) => {
  const user = users[id];
  if (!user) throw new Error(`Unknown user: ${id}`);
  const prompt = systemPrompts[id];
  if (!prompt) throw new Error(`Missing system prompt for: ${id}`);
  return {
    id: user.id,
    displayName: user.displayName,
    title: user.title,
    avatarColor: user.avatarColor,
    systemPrompt: prompt,
  };
});

// --- Channel definitions ---

interface ChannelDef { id: string; name: string; kind: "public" | "private" | "dm"; topic: string; memberIds: string[] }

const channelDefs: ChannelDef[] = [
  { id: "general", name: "general", kind: "public", topic: "Company-wide announcements and work-based matters", memberIds: ["michael", "jim", "dwight", "pam", "ryan", "stanley", "kevin", "angela", "oscar", "andy", "toby", "creed", "kelly", "phyllis", "meredith", "darryl"] },
  { id: "sales", name: "sales", kind: "public", topic: "Sales team discussions and lead tracking", memberIds: ["michael", "jim", "dwight", "stanley", "andy", "phyllis"] },
  { id: "party-planning", name: "party-planning", kind: "public", topic: "Party Planning Committee — Angela Martin, Chair", memberIds: ["angela", "phyllis", "pam", "kelly", "meredith", "kevin", "oscar"] },
  { id: "announcements", name: "announcements", kind: "public", topic: "Official announcements from management", memberIds: ["michael", "jim", "dwight", "pam", "ryan", "stanley", "kevin", "angela", "oscar", "andy", "toby", "creed", "kelly", "phyllis", "meredith", "darryl"] },
  { id: "random", name: "random", kind: "public", topic: "Non-work banter and water cooler conversation", memberIds: ["michael", "jim", "dwight", "pam", "ryan", "kevin", "andy", "creed", "kelly", "darryl"] },
  { id: "accounting", name: "accounting", kind: "private", topic: "Accounting department — budgets, expenses, and reconciliation", memberIds: ["kevin", "oscar", "angela"] },
  { id: "management", name: "management", kind: "private", topic: "Management discussions — HR, promotions, and office policy", memberIds: ["michael", "jim", "toby"] },
];

// --- DM channel definitions ---

const dmDefs: ChannelDef[] = [
  { id: "dm-michael-jim", name: "Michael Scott, Jim Halpert", kind: "dm", topic: "", memberIds: ["michael", "jim"] },
  { id: "dm-michael-dwight", name: "Michael Scott, Dwight Schrute", kind: "dm", topic: "", memberIds: ["michael", "dwight"] },
  { id: "dm-michael-toby", name: "Michael Scott, Toby Flenderson", kind: "dm", topic: "", memberIds: ["michael", "toby"] },
  { id: "dm-michael-ryan", name: "Michael Scott, Ryan Howard", kind: "dm", topic: "", memberIds: ["michael", "ryan"] },
  { id: "dm-jim-pam", name: "Jim Halpert, Pam Beesly", kind: "dm", topic: "", memberIds: ["jim", "pam"] },
  { id: "dm-jim-dwight", name: "Jim Halpert, Dwight Schrute", kind: "dm", topic: "", memberIds: ["jim", "dwight"] },
  { id: "dm-jim-andy", name: "Jim Halpert, Andy Bernard", kind: "dm", topic: "", memberIds: ["jim", "andy"] },
  { id: "dm-dwight-angela", name: "Dwight Schrute, Angela Martin", kind: "dm", topic: "", memberIds: ["dwight", "angela"] },
];

// --- Message definitions (mock ID → data, parent mock ID for threads) ---

interface MessageDef {
  mockId: string;
  channelId: string;
  userId: string;
  text: string;
  createdAt: Date;
  reactions: { emoji: string; userIds: string[] }[];
  parentMockId?: string;
}

const messageDefs: MessageDef[] = [
  // ============ #general ============
  { mockId: "gen-1", channelId: "general", userId: "michael", text: "Good morning everyone! It is a beautiful day at Dunder Mifflin, and I just want to say... I love this company.", createdAt: t(2, 9, 0), reactions: [{ emoji: "❤️", userIds: ["pam", "kevin"] }] },
  { mockId: "gen-2", channelId: "general", userId: "stanley", text: "It's Monday, Michael.", createdAt: t(2, 9, 2), reactions: [] },
  { mockId: "gen-3", channelId: "general", userId: "michael", text: "And what better day to celebrate the gift of employment! Everyone, conference room in 5 minutes. I have a big announcement.", createdAt: t(2, 9, 3), reactions: [{ emoji: "😬", userIds: ["jim", "pam", "oscar"] }] },
  { mockId: "gen-4", channelId: "general", userId: "dwight", text: "I'll prepare the conference room. Everyone should be seated by rank.", createdAt: t(2, 9, 4), reactions: [] },
  { mockId: "gen-5", channelId: "general", userId: "jim", text: "What rank system are we using today, Dwight?", createdAt: t(2, 9, 5), reactions: [{ emoji: "😂", userIds: ["pam", "kevin", "oscar"] }] },
  { mockId: "gen-6", channelId: "general", userId: "dwight", text: "Schrute family hierarchy. Obviously. It's based on beet yield per acre.", createdAt: t(2, 9, 6), reactions: [{ emoji: "🥬", userIds: ["creed"] }] },
  { mockId: "gen-7", channelId: "general", userId: "pam", text: "Reminder: the kitchen fridge will be cleaned out on Friday. Please label your food. Kevin, this means you.", createdAt: t(2, 10, 30), reactions: [{ emoji: "👍", userIds: ["oscar", "angela"] }] },
  { mockId: "gen-8", channelId: "general", userId: "kevin", text: "But my chili needs time to marinate! It's a Malone family recipe.", createdAt: t(2, 10, 32), reactions: [{ emoji: "🍲", userIds: ["michael"] }] },
  { mockId: "gen-9", channelId: "general", userId: "creed", text: "I've been storing something in that fridge for three years. Nobody touch it.", createdAt: t(2, 11, 0), reactions: [{ emoji: "😨", userIds: ["pam", "jim", "angela"] }] },
  { mockId: "gen-10", channelId: "general", userId: "angela", text: "This is exactly why we need stricter kitchen policies. I have drafted a 12-page proposal.", createdAt: t(2, 11, 5), reactions: [] },
  { mockId: "gen-11", channelId: "general", userId: "oscar", text: "Angela, a 12-page kitchen policy seems a bit excessive.", createdAt: t(2, 11, 7), reactions: [{ emoji: "💯", userIds: ["jim", "stanley"] }] },
  { mockId: "gen-12", channelId: "general", userId: "toby", text: "Hey everyone, just a reminder that the annual safety training is coming up next week. Please sign up on the sheet by my desk.", createdAt: t(1, 9, 0), reactions: [] },
  { mockId: "gen-13", channelId: "general", userId: "michael", text: "Nobody cares, Toby. Why are you the way that you are?", createdAt: t(1, 9, 1), reactions: [{ emoji: "😂", userIds: ["jim", "dwight", "ryan"] }] },
  { mockId: "gen-14", channelId: "general", userId: "kelly", text: "OMG has anyone seen the new episode of The Bachelor last night?? I literally cannot even right now. 💀", createdAt: t(1, 10, 15), reactions: [{ emoji: "💀", userIds: ["ryan"] }] },
  { mockId: "gen-15", channelId: "general", userId: "darryl", text: "Heads up — forklift maintenance is happening this afternoon. Warehouse will be loud. Try not to send Michael down here.", createdAt: t(1, 11, 0), reactions: [{ emoji: "😂", userIds: ["jim", "pam"] }, { emoji: "🏗️", userIds: ["michael"] }] },
  { mockId: "gen-16", channelId: "general", userId: "michael", text: "I drove the forklift ONE time, Darryl. And I'd argue I was the best forklift driver this office has ever seen.", createdAt: t(1, 11, 3), reactions: [{ emoji: "🤦", userIds: ["darryl", "jim", "pam"] }] },
  { mockId: "gen-17", channelId: "general", userId: "andy", text: "Hey everyone! I just want to say I am PUMPED to be here today. Nard Dog is ready to sell some paper! 🐕", createdAt: t(0, 8, 45), reactions: [{ emoji: "🐕", userIds: ["michael"] }] },
  { mockId: "gen-18", channelId: "general", userId: "michael", text: "That's what she said! ...wait, that doesn't work there. Or does it? 🤔", createdAt: t(0, 9, 0), reactions: [{ emoji: "😂", userIds: ["jim", "kevin", "andy"] }, { emoji: "🤦", userIds: ["pam", "oscar", "angela"] }] },

  // ============ #sales ============
  { mockId: "sal-1", channelId: "sales", userId: "jim", text: "Just closed the Lackawanna County deal. 50 boxes monthly, 2-year contract.", createdAt: t(2, 10, 0), reactions: [{ emoji: "🎉", userIds: ["michael", "phyllis", "pam"] }] },
  { mockId: "sal-2", channelId: "sales", userId: "dwight", text: "That was MY lead, Jim. I had them on the hook for 75 boxes.", createdAt: t(2, 10, 5), reactions: [] },
  { mockId: "sal-3", channelId: "sales", userId: "jim", text: "Dwight, you literally threw a beet at their CFO.", createdAt: t(2, 10, 6), reactions: [{ emoji: "😂", userIds: ["michael", "andy", "phyllis"] }] },
  { mockId: "sal-4", channelId: "sales", userId: "dwight", text: "It was a GIFT, Jim. In Schrute culture, offering a beet is the highest form of business respect.", createdAt: t(2, 10, 7), reactions: [{ emoji: "🥬", userIds: ["creed"] }] },
  { mockId: "sal-5", channelId: "sales", userId: "michael", text: "Great work, team! We are crushing it this quarter. Pizza party when we hit target!", createdAt: t(2, 10, 30), reactions: [{ emoji: "🍕", userIds: ["kevin", "jim", "andy"] }] },
  { mockId: "sal-6", channelId: "sales", userId: "stanley", text: "Are we done here? I have a crossword to finish.", createdAt: t(2, 10, 35), reactions: [] },
  { mockId: "sal-7", channelId: "sales", userId: "phyllis", text: "I have a lead from Bob Vance, Vance Refrigeration. They need custom letterhead.", createdAt: t(1, 9, 30), reactions: [] },
  { mockId: "sal-8", channelId: "sales", userId: "michael", text: "Bob Vance! Love that guy. Phyllis, tell Bob I said what's up and that I'm available for couples game night anytime.", createdAt: t(1, 9, 35), reactions: [] },
  { mockId: "sal-9", channelId: "sales", userId: "andy", text: "Q3 numbers are looking good, gang. The Nard Dog is bringing home the bacon! Beer me five! 🖐️", createdAt: t(1, 14, 0), reactions: [{ emoji: "🖐️", userIds: ["michael"] }] },
  { mockId: "sal-10", channelId: "sales", userId: "jim", text: "Quick update — Harper Collins wants to renegotiate. Meeting Thursday at 2.", createdAt: t(0, 9, 15), reactions: [{ emoji: "👍", userIds: ["michael", "stanley"] }] },
  { mockId: "sal-11", channelId: "sales", userId: "dwight", text: "I will be at that meeting. I will also bring my katana in case negotiations get heated.", createdAt: t(0, 9, 17), reactions: [{ emoji: "⚔️", userIds: ["creed"] }, { emoji: "😬", userIds: ["jim", "phyllis"] }] },
  { mockId: "sal-12", channelId: "sales", userId: "jim", text: "Please don't bring the katana, Dwight.", createdAt: t(0, 9, 18), reactions: [] },

  // ============ #party-planning ============
  { mockId: "pp-1", channelId: "party-planning", userId: "angela", text: "Committee meeting at 3 PM today. Attendance is MANDATORY. Agenda: Halloween decorations budget.", createdAt: t(2, 8, 0), reactions: [] },
  { mockId: "pp-2", channelId: "party-planning", userId: "phyllis", text: "I was thinking we could do a harvest theme this year? Bob and I saw the cutest pumpkin display—", createdAt: t(2, 8, 5), reactions: [] },
  { mockId: "pp-3", channelId: "party-planning", userId: "angela", text: "Phyllis, we are NOT doing harvest theme. We're doing Nutcracker theme. I already ordered the decorations.", createdAt: t(2, 8, 6), reactions: [{ emoji: "😑", userIds: ["phyllis", "pam"] }] },
  { mockId: "pp-4", channelId: "party-planning", userId: "kelly", text: "Can we do a Beyoncé theme?? That would be SO iconic.", createdAt: t(2, 9, 0), reactions: [{ emoji: "💃", userIds: ["kelly"] }] },
  { mockId: "pp-5", channelId: "party-planning", userId: "angela", text: "No.", createdAt: t(2, 9, 1), reactions: [] },
  { mockId: "pp-6", channelId: "party-planning", userId: "kevin", text: "Can we at least make sure there's enough cake this time? Last party I only got one slice.", createdAt: t(2, 9, 15), reactions: [] },
  { mockId: "pp-7", channelId: "party-planning", userId: "angela", text: "Kevin, you took FOUR slices last time. I was counting.", createdAt: t(2, 9, 16), reactions: [{ emoji: "😂", userIds: ["oscar", "pam"] }] },
  { mockId: "pp-8", channelId: "party-planning", userId: "pam", text: "I can make some decorations if we need them! I've been working on my watercolors.", createdAt: t(1, 10, 0), reactions: [{ emoji: "🎨", userIds: ["jim"] }] },
  { mockId: "pp-9", channelId: "party-planning", userId: "angela", text: "Fine, Pam. But they have to match my color scheme: eggshell, ivory, and cream. NO other colors.", createdAt: t(1, 10, 5), reactions: [{ emoji: "😐", userIds: ["pam"] }] },
  { mockId: "pp-10", channelId: "party-planning", userId: "oscar", text: "Angela, those are all the same color.", createdAt: t(1, 10, 7), reactions: [{ emoji: "💯", userIds: ["jim", "kevin"] }] },
  { mockId: "pp-11", channelId: "party-planning", userId: "angela", text: "They are NOT the same color, Oscar. You clearly have no eye for design.", createdAt: t(1, 10, 8), reactions: [] },
  { mockId: "pp-12", channelId: "party-planning", userId: "meredith", text: "Can we just make sure there's an open bar this time?", createdAt: t(1, 14, 0), reactions: [{ emoji: "🍺", userIds: ["creed"] }] },

  // ============ #announcements ============
  { mockId: "ann-1", channelId: "announcements", userId: "michael", text: "📢 ATTENTION EVERYONE! This Friday is Pretzel Day! The pretzel guy is coming back!", createdAt: t(3, 9, 0), reactions: [{ emoji: "🥨", userIds: ["stanley", "kevin", "pam", "jim", "andy"] }, { emoji: "🎉", userIds: ["michael", "kelly"] }] },
  { mockId: "ann-2", channelId: "announcements", userId: "stanley", text: "Did someone say Pretzel Day?", createdAt: t(3, 9, 1), reactions: [{ emoji: "😍", userIds: ["stanley"] }] },
  { mockId: "ann-3", channelId: "announcements", userId: "toby", text: "Just a reminder that we need to complete our quarterly compliance training by end of month. Link is in your email.", createdAt: t(2, 8, 0), reactions: [] },
  { mockId: "ann-4", channelId: "announcements", userId: "michael", text: "Toby, nobody reads your emails. I delete them as a matter of principle.", createdAt: t(2, 8, 5), reactions: [{ emoji: "💀", userIds: ["jim", "ryan"] }] },
  { mockId: "ann-5", channelId: "announcements", userId: "dwight", text: "🚨 FIRE DRILL will be conducted this Thursday at 2 PM. This is NOT a test. I mean, it IS a test, but treat it like it's real. Your lives depend on it.", createdAt: t(1, 7, 30), reactions: [{ emoji: "🔥", userIds: ["ryan"] }, { emoji: "😰", userIds: ["kevin", "angela"] }] },
  { mockId: "ann-6", channelId: "announcements", userId: "oscar", text: "Dwight, the last fire drill you conducted involved an actual fire in the building.", createdAt: t(1, 7, 35), reactions: [{ emoji: "😂", userIds: ["jim", "pam", "kelly"] }] },
  { mockId: "ann-7", channelId: "announcements", userId: "michael", text: "🏆 Employee of the Month goes to... EVERYONE! Because you're all special. Except Toby.", createdAt: t(0, 9, 0), reactions: [{ emoji: "🏆", userIds: ["andy", "kelly"] }, { emoji: "😢", userIds: ["toby"] }] },

  // ============ #random ============
  { mockId: "ran-1", channelId: "random", userId: "kevin", text: "Does anyone know if the vending machine takes $5 bills? Asking for a friend. The friend is me.", createdAt: t(2, 12, 0), reactions: [{ emoji: "😂", userIds: ["jim", "pam"] }] },
  { mockId: "ran-2", channelId: "random", userId: "creed", text: "I found a turtle in the parking lot. He's mine now. His name is Chancellor.", createdAt: t(2, 13, 0), reactions: [{ emoji: "🐢", userIds: ["kevin", "kelly"] }, { emoji: "😨", userIds: ["angela"] }] },
  { mockId: "ran-3", channelId: "random", userId: "andy", text: "🎵 I'm just a small town girl, living in a lonely world... 🎵 Who wants to do karaoke tonight?", createdAt: t(2, 15, 0), reactions: [{ emoji: "🎤", userIds: ["michael", "kelly"] }] },
  { mockId: "ran-4", channelId: "random", userId: "jim", text: "Just found out Dwight has a custom license plate that says 'BEETS'. Not surprised at all.", createdAt: t(1, 11, 30), reactions: [{ emoji: "😂", userIds: ["pam", "andy", "kevin"] }] },
  { mockId: "ran-5", channelId: "random", userId: "dwight", text: "FALSE. It says 'BEET ME'. Which is a challenge.", createdAt: t(1, 11, 32), reactions: [{ emoji: "😂", userIds: ["jim", "pam", "michael"] }] },
  { mockId: "ran-6", channelId: "random", userId: "kelly", text: "Ryan just liked my Instagram post from 3 weeks ago. Do you think that means something?? 🤔💕", createdAt: t(1, 14, 0), reactions: [{ emoji: "💔", userIds: ["pam"] }] },
  { mockId: "ran-7", channelId: "random", userId: "ryan", text: "It was an accident.", createdAt: t(1, 14, 2), reactions: [{ emoji: "💀", userIds: ["jim", "kevin"] }] },
  { mockId: "ran-8", channelId: "random", userId: "michael", text: "Movie quote game! I'll start: 'You miss 100% of the shots you don't take. - Wayne Gretzky' - Michael Scott", createdAt: t(0, 10, 0), reactions: [{ emoji: "🏒", userIds: ["andy"] }, { emoji: "🤦", userIds: ["jim", "oscar"] }] },
  { mockId: "ran-9", channelId: "random", userId: "darryl", text: "Michael, that's not a movie quote.", createdAt: t(0, 10, 2), reactions: [] },
  { mockId: "ran-10", channelId: "random", userId: "michael", text: "It's from the movie of my LIFE, Darryl.", createdAt: t(0, 10, 3), reactions: [{ emoji: "😂", userIds: ["jim", "pam", "andy", "kevin"] }] },

  // ============ #accounting ============
  { mockId: "acc-1", channelId: "accounting", userId: "angela", text: "Q3 expense reports are due by end of day Friday. No exceptions. Kevin, that includes you.", createdAt: t(2, 9, 0), reactions: [] },
  { mockId: "acc-2", channelId: "accounting", userId: "kevin", text: "I'm working on it. Math is hard when the numbers are big.", createdAt: t(2, 9, 5), reactions: [{ emoji: "🤦", userIds: ["angela"] }] },
  { mockId: "acc-3", channelId: "accounting", userId: "oscar", text: "Kevin, you literally just have to add up the receipts. I made you a spreadsheet template.", createdAt: t(2, 9, 10), reactions: [] },
  { mockId: "acc-4", channelId: "accounting", userId: "kevin", text: "The spreadsheet has too many columns. Can we just do one big column?", createdAt: t(2, 9, 15), reactions: [{ emoji: "😂", userIds: ["oscar"] }] },
  { mockId: "acc-5", channelId: "accounting", userId: "angela", text: "I found a $200 discrepancy in the petty cash. Someone explain. NOW.", createdAt: t(1, 10, 0), reactions: [] },
  { mockId: "acc-6", channelId: "accounting", userId: "kevin", text: "It wasn't me. Although I did buy a lot of vending machine snacks last week.", createdAt: t(1, 10, 5), reactions: [] },
  { mockId: "acc-7", channelId: "accounting", userId: "oscar", text: "I ran the numbers again. The discrepancy is from Michael's 'business lunch' at Benihana. He charged it to office supplies.", createdAt: t(1, 10, 15), reactions: [{ emoji: "😑", userIds: ["angela"] }] },
  { mockId: "acc-8", channelId: "accounting", userId: "angela", text: "I am filing a formal complaint. This is the third time this quarter.", createdAt: t(1, 10, 20), reactions: [] },

  // ============ #management ============
  { mockId: "mgt-1", channelId: "management", userId: "michael", text: "Team, I've been thinking about promotions. Everybody deserves one, right? Is that how it works?", createdAt: t(2, 14, 0), reactions: [] },
  { mockId: "mgt-2", channelId: "management", userId: "toby", text: "Michael, we have a budget and a formal review process. We can't just promote everyone.", createdAt: t(2, 14, 5), reactions: [] },
  { mockId: "mgt-3", channelId: "management", userId: "michael", text: "Toby, you are the silent killer. Go back to the annex.", createdAt: t(2, 14, 6), reactions: [{ emoji: "😬", userIds: ["jim"] }] },
  { mockId: "mgt-4", channelId: "management", userId: "jim", text: "We should probably discuss the open sales position first. I have a few candidates in mind.", createdAt: t(1, 11, 0), reactions: [{ emoji: "👍", userIds: ["toby"] }] },
  { mockId: "mgt-5", channelId: "management", userId: "toby", text: "Agreed. I've put together a shortlist. Also, reminder that annual reviews start next month.", createdAt: t(1, 11, 10), reactions: [] },
  { mockId: "mgt-6", channelId: "management", userId: "michael", text: "I'll handle the reviews personally. I already have superlatives picked out. Jim, you're 'Most Likely to Be Jim'.", createdAt: t(0, 9, 30), reactions: [{ emoji: "😂", userIds: ["jim"] }] },

  // ============ DM: michael-jim ============
  { mockId: "dm-mj-1", channelId: "dm-michael-jim", userId: "michael", text: "Jim! My main man. My number two. My right hand. Want to get lunch?", createdAt: t(1, 11, 0), reactions: [] },
  { mockId: "dm-mj-2", channelId: "dm-michael-jim", userId: "jim", text: "Sure Michael, where were you thinking?", createdAt: t(1, 11, 5), reactions: [] },
  { mockId: "dm-mj-3", channelId: "dm-michael-jim", userId: "michael", text: "Chili's! The new Awesome Blossom is calling my name. 🌺", createdAt: t(1, 11, 6), reactions: [{ emoji: "😂", userIds: ["jim"] }] },
  { mockId: "dm-mj-4", channelId: "dm-michael-jim", userId: "jim", text: "Michael, Chili's banned you.", createdAt: t(1, 11, 8), reactions: [] },
  { mockId: "dm-mj-5", channelId: "dm-michael-jim", userId: "michael", text: "That was a MISUNDERSTANDING. I was just showing everyone the Dundies.", createdAt: t(1, 11, 9), reactions: [] },
  { mockId: "dm-mj-6", channelId: "dm-michael-jim", userId: "jim", text: "How about Cooper's? They have good sandwiches.", createdAt: t(1, 11, 10), reactions: [] },
  { mockId: "dm-mj-7", channelId: "dm-michael-jim", userId: "michael", text: "Deal! You're paying though. Boss privileges. 😎", createdAt: t(1, 11, 11), reactions: [] },

  // ============ DM: michael-dwight ============
  { mockId: "dm-md-1", channelId: "dm-michael-dwight", userId: "dwight", text: "Michael, I've prepared my quarterly beet harvest report. Permission to present it in the conference room?", createdAt: t(1, 8, 0), reactions: [] },
  { mockId: "dm-md-2", channelId: "dm-michael-dwight", userId: "michael", text: "Dwight, nobody wants to see your beet report.", createdAt: t(1, 8, 5), reactions: [] },
  { mockId: "dm-md-3", channelId: "dm-michael-dwight", userId: "dwight", text: "It has GRAPHS, Michael. Color-coded graphs.", createdAt: t(1, 8, 6), reactions: [] },
  { mockId: "dm-md-4", channelId: "dm-michael-dwight", userId: "michael", text: "Fine, you have 3 minutes. And NO bringing actual beets into the conference room again.", createdAt: t(1, 8, 10), reactions: [] },
  { mockId: "dm-md-5", channelId: "dm-michael-dwight", userId: "dwight", text: "Thank you, Michael. Also, I wanted to discuss promoting me to Assistant Regional Manager officially.", createdAt: t(1, 8, 15), reactions: [] },
  { mockId: "dm-md-6", channelId: "dm-michael-dwight", userId: "michael", text: "You are the Assistant TO the Regional Manager, Dwight. We've been over this.", createdAt: t(1, 8, 20), reactions: [] },

  // ============ DM: michael-toby ============
  { mockId: "dm-mt-1", channelId: "dm-michael-toby", userId: "toby", text: "Hi Michael, just following up on the harassment complaint from last week. We need to schedule a meeting.", createdAt: t(2, 9, 0), reactions: [] },
  { mockId: "dm-mt-2", channelId: "dm-michael-toby", userId: "michael", text: "No.", createdAt: t(2, 9, 30), reactions: [] },
  { mockId: "dm-mt-3", channelId: "dm-michael-toby", userId: "toby", text: "Michael, it's required by corporate policy.", createdAt: t(2, 10, 0), reactions: [] },
  { mockId: "dm-mt-4", channelId: "dm-michael-toby", userId: "michael", text: "If I had a gun with two bullets and I was in a room with Hitler, Bin Laden, and Toby, I'd shoot Toby twice.", createdAt: t(2, 10, 5), reactions: [] },
  { mockId: "dm-mt-5", channelId: "dm-michael-toby", userId: "toby", text: "I'm going to pretend I didn't see that. The meeting is Thursday at 10.", createdAt: t(2, 10, 10), reactions: [] },

  // ============ DM: michael-ryan ============
  { mockId: "dm-mr-1", channelId: "dm-michael-ryan", userId: "michael", text: "Ryan! My temp! Have you checked out my screenplay yet? It's called 'Threat Level Midnight'.", createdAt: t(1, 15, 0), reactions: [] },
  { mockId: "dm-mr-2", channelId: "dm-michael-ryan", userId: "ryan", text: "I'll look at it when I have time, Michael.", createdAt: t(1, 15, 30), reactions: [] },
  { mockId: "dm-mr-3", channelId: "dm-michael-ryan", userId: "michael", text: "You're going to love it. There's a role for you. You play the temp who saves the world.", createdAt: t(1, 15, 31), reactions: [] },
  { mockId: "dm-mr-4", channelId: "dm-michael-ryan", userId: "ryan", text: "Great.", createdAt: t(1, 15, 35), reactions: [] },

  // ============ DM: jim-pam ============
  { mockId: "dm-jp-1", channelId: "dm-jim-pam", userId: "jim", text: "Pam. Dwight just put a bobblehead of himself on my desk. This is escalating.", createdAt: t(1, 10, 0), reactions: [] },
  { mockId: "dm-jp-2", channelId: "dm-jim-pam", userId: "pam", text: "😂 Are you serious?? Where did he even get a custom bobblehead?", createdAt: t(1, 10, 2), reactions: [] },
  { mockId: "dm-jp-3", channelId: "dm-jim-pam", userId: "jim", text: "I don't want to know. But I'm putting it in jello. The plan is already in motion.", createdAt: t(1, 10, 3), reactions: [{ emoji: "😂", userIds: ["pam"] }] },
  { mockId: "dm-jp-4", channelId: "dm-jim-pam", userId: "pam", text: "You need to let me watch when he finds it. I'll bring popcorn.", createdAt: t(1, 10, 5), reactions: [] },
  { mockId: "dm-jp-5", channelId: "dm-jim-pam", userId: "jim", text: "Deal. Also, dinner tonight? I was thinking Italian.", createdAt: t(1, 10, 6), reactions: [] },
  { mockId: "dm-jp-6", channelId: "dm-jim-pam", userId: "pam", text: "Yes! Alfredo's Pizza Cafe, NOT Pizza by Alfredo. There's a big difference.", createdAt: t(1, 10, 7), reactions: [{ emoji: "❤️", userIds: ["jim"] }] },
  { mockId: "dm-jp-7", channelId: "dm-jim-pam", userId: "jim", text: "Obviously. One is a hot circle of garbage.", createdAt: t(1, 10, 8), reactions: [] },

  // ============ DM: jim-dwight ============
  { mockId: "dm-jd-1", channelId: "dm-jim-dwight", userId: "dwight", text: "Jim, I know you moved my desk 2 inches to the left. I measured.", createdAt: t(2, 14, 0), reactions: [] },
  { mockId: "dm-jd-2", channelId: "dm-jim-dwight", userId: "jim", text: "Dwight, I have no idea what you're talking about.", createdAt: t(2, 14, 5), reactions: [] },
  { mockId: "dm-jd-3", channelId: "dm-jim-dwight", userId: "dwight", text: "I have photographic evidence. I take daily photos of my desk perimeter.", createdAt: t(2, 14, 6), reactions: [] },
  { mockId: "dm-jd-4", channelId: "dm-jim-dwight", userId: "jim", text: "That's... very normal behavior.", createdAt: t(2, 14, 7), reactions: [] },
  { mockId: "dm-jd-5", channelId: "dm-jim-dwight", userId: "dwight", text: "Also, STOP putting my stapler in jello. That's the third one this month.", createdAt: t(0, 9, 0), reactions: [] },
  { mockId: "dm-jd-6", channelId: "dm-jim-dwight", userId: "jim", text: "I told you, I don't know what happened to your stapler.", createdAt: t(0, 9, 5), reactions: [] },

  // ============ DM: jim-andy ============
  { mockId: "dm-ja-1", channelId: "dm-jim-andy", userId: "andy", text: "Big Tuna! Want to join my a cappella group? We need a baritone.", createdAt: t(1, 13, 0), reactions: [] },
  { mockId: "dm-ja-2", channelId: "dm-jim-andy", userId: "jim", text: "I'm going to pass, Andy. But thanks for thinking of me.", createdAt: t(1, 13, 10), reactions: [] },
  { mockId: "dm-ja-3", channelId: "dm-jim-andy", userId: "andy", text: "Your loss, Tuna. We're doing a set of all Maroon 5 songs converted to a cappella. It's going to be legendary.", createdAt: t(1, 13, 15), reactions: [] },
  { mockId: "dm-ja-4", channelId: "dm-jim-andy", userId: "jim", text: "I'm sure it will be.", createdAt: t(1, 13, 20), reactions: [] },

  // ============ DM: dwight-angela ============
  { mockId: "dm-da-1", channelId: "dm-dwight-angela", userId: "dwight", text: "Monkey, the new barn cat is adjusting well. She caught 4 mice yesterday.", createdAt: t(1, 19, 0), reactions: [] },
  { mockId: "dm-da-2", channelId: "dm-dwight-angela", userId: "angela", text: "That's wonderful D. I knew she'd be a good fit for the farm. How are the other cats?", createdAt: t(1, 19, 10), reactions: [] },
  { mockId: "dm-da-3", channelId: "dm-dwight-angela", userId: "dwight", text: "Garbage is thriving. Mr. Ash is asserting dominance over the hay loft territory. Milky Way is... still weird.", createdAt: t(1, 19, 15), reactions: [{ emoji: "🐱", userIds: ["angela"] }] },
  { mockId: "dm-da-4", channelId: "dm-dwight-angela", userId: "angela", text: "I wish I could visit this weekend but I have a cat show in Philadelphia. Sprinkles Jr. is competing in 3 categories.", createdAt: t(1, 19, 20), reactions: [] },
  { mockId: "dm-da-5", channelId: "dm-dwight-angela", userId: "dwight", text: "Understood. I'll send photos of the beet harvest progress. This year's yield will be MAGNIFICENT.", createdAt: t(1, 19, 25), reactions: [{ emoji: "❤️", userIds: ["angela"] }] },
];

// --- Thread reply definitions ---

interface ThreadReplyDef {
  mockId: string;
  parentMockId: string;
  userId: string;
  text: string;
  createdAt: Date;
  reactions: { emoji: string; userIds: string[] }[];
}

const threadReplyDefs: ThreadReplyDef[] = [
  // gen-3: Michael's big announcement
  { mockId: "gen-3-r1", parentMockId: "gen-3", userId: "jim", text: "Please tell me it's not another movie Monday.", createdAt: t(2, 9, 10), reactions: [{ emoji: "😂", userIds: ["pam"] }] },
  { mockId: "gen-3-r2", parentMockId: "gen-3", userId: "dwight", text: 'I hope it\'s a promotion announcement. I\'ve been preparing my "Assistant Regional Manager" acceptance speech.', createdAt: t(2, 9, 12), reactions: [] },
  { mockId: "gen-3-r3", parentMockId: "gen-3", userId: "pam", text: "Last time he had a 'big announcement' it was that he learned how to make espresso.", createdAt: t(2, 9, 15), reactions: [{ emoji: "☕", userIds: ["jim", "oscar"] }] },

  // gen-7: Fridge cleanup
  { mockId: "gen-7-r1", parentMockId: "gen-7", userId: "kevin", text: "Can I at least keep my M&Ms in there? They're organized by color.", createdAt: t(2, 10, 35), reactions: [] },
  { mockId: "gen-7-r2", parentMockId: "gen-7", userId: "pam", text: "Kevin, your M&Ms are fine. I'm talking about the unlabeled containers that have been there since March.", createdAt: t(2, 10, 40), reactions: [{ emoji: "👍", userIds: ["angela"] }] },

  // sal-1: Jim's deal
  { mockId: "sal-1-r1", parentMockId: "sal-1", userId: "michael", text: "That's my boy! Drinks on me tonight! (just kidding you're paying)", createdAt: t(2, 10, 10), reactions: [{ emoji: "😂", userIds: ["jim"] }] },
  { mockId: "sal-1-r2", parentMockId: "sal-1", userId: "dwight", text: "I want it on record that I softened them up with my initial pitch. Jim just closed what I started.", createdAt: t(2, 10, 15), reactions: [] },

  // pp-1: Angela's committee meeting
  { mockId: "pp-1-r1", parentMockId: "pp-1", userId: "phyllis", text: "Can we push it to 3:30? I have a call with Bob Vance at 3.", createdAt: t(2, 8, 10), reactions: [] },
  { mockId: "pp-1-r2", parentMockId: "pp-1", userId: "angela", text: "No. 3 PM means 3 PM. Bob Vance can wait.", createdAt: t(2, 8, 12), reactions: [] },
  { mockId: "pp-1-r3", parentMockId: "pp-1", userId: "kevin", text: "Will there be snacks at the meeting?", createdAt: t(2, 8, 15), reactions: [{ emoji: "🍪", userIds: ["kevin"] }] },

  // ann-1: Pretzel Day
  { mockId: "ann-1-r1", parentMockId: "ann-1", userId: "stanley", text: "I have been waiting for this day for 364 days. I have cleared my schedule.", createdAt: t(3, 9, 5), reactions: [{ emoji: "🥨", userIds: ["kevin", "michael"] }] },
  { mockId: "ann-1-r2", parentMockId: "ann-1", userId: "kevin", text: "Stanley and I are forming an alliance to be first in line.", createdAt: t(3, 9, 10), reactions: [] },

  // acc-5: Petty cash discrepancy
  { mockId: "acc-5-r1", parentMockId: "acc-5", userId: "kevin", text: "I may have accidentally used the petty cash for the vending machine. But in my defense, those pretzels were really good.", createdAt: t(1, 10, 10), reactions: [] },
  { mockId: "acc-5-r2", parentMockId: "acc-5", userId: "angela", text: "Kevin, that is NOT what petty cash is for. I'm adding this to your file.", createdAt: t(1, 10, 12), reactions: [] },

  // ran-2: Creed's turtle
  { mockId: "ran-2-r1", parentMockId: "ran-2", userId: "jim", text: "Creed, you can't just claim a random turtle.", createdAt: t(2, 13, 5), reactions: [] },
  { mockId: "ran-2-r2", parentMockId: "ran-2", userId: "creed", text: "In the '60s I claimed a lot more than turtles. Chancellor stays.", createdAt: t(2, 13, 10), reactions: [{ emoji: "😂", userIds: ["jim", "kevin"] }] },
];

// --- Memory block definitions ---

interface MemoryBlockDef { agentId: string; label: string; content: string }

const memoryBlockDefs: MemoryBlockDef[] = SWITCHABLE_USER_IDS.flatMap((id) => {
  const blocks = memoryBlockData[id];
  if (!blocks) throw new Error(`Missing memory blocks for: ${id}`);
  return [
    { agentId: id, label: "personality", content: blocks.personality },
    { agentId: id, label: "relationships", content: blocks.relationships },
    { agentId: id, label: "current_state", content: blocks.current_state },
  ];
});

// --- Unread counts (read cursor targets) ---
// Each entry means "user X has N unread messages in channel Y"

const unreadTargets: Record<string, Record<string, number>> = {
  michael: { sales: 3, "party-planning": 5, random: 2, "dm-michael-toby": 1, management: 2 },
  jim: { general: 4, announcements: 2, "dm-jim-andy": 1, "dm-jim-dwight": 2, management: 1 },
  dwight: { general: 2, random: 3, "party-planning": 4, "dm-dwight-angela": 1 },
  pam: { general: 3, "party-planning": 2 },
  ryan: { random: 1, announcements: 3 },
  stanley: { sales: 2 },
  kevin: { general: 1, "party-planning": 3, accounting: 4 },
  angela: { "party-planning": 1, accounting: 2 },
  oscar: { general: 2, accounting: 3 },
  andy: { sales: 1, random: 2 },
  toby: { general: 5, management: 3 },
  creed: { random: 1 },
  kelly: { "party-planning": 2, random: 1 },
  phyllis: { sales: 1, "party-planning": 3 },
  meredith: { "party-planning": 1 },
  darryl: { general: 2, random: 1 },
};

// --- Seed function ---

async function seed() {
  const { db } = await import("./client");
  const { agents, channels, channelMembers, messages, reactions, memoryBlocks, channelReads, runs, runSteps, runMessages, scheduledMessages } = await import("./schema");
  const { sql } = await import("drizzle-orm");

  const allChannelDefs = [...channelDefs, ...dmDefs];

  // 1. Agents
  console.log("Seeding agents...");
  await db.insert(agents).values(agentRows).onConflictDoUpdate({
    target: agents.id,
    set: {
      displayName: sql`excluded.display_name`,
      title: sql`excluded.title`,
      avatarColor: sql`excluded.avatar_color`,
      systemPrompt: sql`excluded.system_prompt`,
      maxTurns: sql`excluded.max_turns`,
    },
  });
  console.log(`  ${agentRows.length} agents`);

  // 2. Channels (public + private + DMs)
  console.log("Seeding channels...");
  const channelRows = allChannelDefs.map(({ id, name, kind, topic }) => ({ id, name, kind, topic }));
  await db.insert(channels).values(channelRows).onConflictDoNothing({ target: channels.id });
  console.log(`  ${channelRows.length} channels`);

  // 3. Channel members — truncate and re-insert for idempotency
  console.log("Seeding channel members...");
  await db.delete(channelMembers);
  const memberRows = allChannelDefs.flatMap((ch) =>
    ch.memberIds.map((userId) => ({ channelId: ch.id, userId })),
  );
  await db.insert(channelMembers).values(memberRows);
  console.log(`  ${memberRows.length} channel memberships`);

  // 4. Runs — clear all agent run history (FK: runMessages → runSteps → runs → messages)
  console.log("Clearing runs...");
  await db.delete(runMessages);
  await db.delete(runSteps);
  await db.delete(runs);

  // 5. Messages — truncate reactions first (FK), then messages, then re-insert
  console.log("Seeding messages...");
  await db.delete(reactions);
  await db.delete(messages);

  // Insert top-level messages and capture mockId → UUID mapping
  const mockIdToUuid = new Map<string, string>();

  // Insert in batches to maintain ordering (createdAt is set explicitly)
  const topLevelRows = messageDefs.map((m) => ({
    channelId: m.channelId,
    userId: m.userId,
    text: m.text,
    createdAt: m.createdAt,
  }));

  const insertedMessages = await db.insert(messages).values(topLevelRows).returning({ id: messages.id });

  for (let i = 0; i < messageDefs.length; i++) {
    const def = messageDefs[i];
    const inserted = insertedMessages[i];
    if (!def || !inserted) throw new Error(`Mismatch at index ${i}`);
    mockIdToUuid.set(def.mockId, inserted.id);
  }
  console.log(`  ${messageDefs.length} top-level messages`);

  // 5. Thread replies
  console.log("Seeding thread replies...");
  const replyRows = threadReplyDefs.map((r) => {
    const parentUuid = mockIdToUuid.get(r.parentMockId);
    if (!parentUuid) throw new Error(`Parent message not found: ${r.parentMockId}`);
    return {
      channelId: messageDefs.find((m) => m.mockId === r.parentMockId)?.channelId ?? r.parentMockId,
      parentMessageId: parentUuid,
      userId: r.userId,
      text: r.text,
      createdAt: r.createdAt,
    };
  });

  const insertedReplies = await db.insert(messages).values(replyRows).returning({ id: messages.id });

  for (let i = 0; i < threadReplyDefs.length; i++) {
    const def = threadReplyDefs[i];
    const inserted = insertedReplies[i];
    if (!def || !inserted) throw new Error(`Reply mismatch at index ${i}`);
    mockIdToUuid.set(def.mockId, inserted.id);
  }
  console.log(`  ${threadReplyDefs.length} thread replies`);

  // 6. Reactions — flatten from all messages + replies
  console.log("Seeding reactions...");
  const allMsgDefs: { mockId: string; reactions: { emoji: string; userIds: string[] }[] }[] = [
    ...messageDefs,
    ...threadReplyDefs,
  ];

  const reactionRows: { messageId: string; userId: string; emoji: string }[] = [];
  for (const msg of allMsgDefs) {
    const dbId = mockIdToUuid.get(msg.mockId);
    if (!dbId) continue;
    for (const reaction of msg.reactions) {
      for (const userId of reaction.userIds) {
        reactionRows.push({ messageId: dbId, userId, emoji: reaction.emoji });
      }
    }
  }

  if (reactionRows.length > 0) {
    await db.insert(reactions).values(reactionRows);
  }
  console.log(`  ${reactionRows.length} reactions`);

  // 7. Memory blocks — upsert via unique index (agent_id, label)
  console.log("Seeding memory blocks...");
  await db
    .insert(memoryBlocks)
    .values(memoryBlockDefs)
    .onConflictDoNothing();
  console.log(`  ${memoryBlockDefs.length} memory blocks`);

  // 8. Channel reads — compute read cursors from unreadTargets
  console.log("Seeding channel reads...");
  await db.delete(channelReads);

  // Group top-level messages by channel, sorted by createdAt ASC
  const topLevelByChannel = new Map<string, { createdAt: Date }[]>();
  for (const def of messageDefs) {
    const list = topLevelByChannel.get(def.channelId) ?? [];
    list.push({ createdAt: def.createdAt });
    topLevelByChannel.set(def.channelId, list);
  }
  for (const list of topLevelByChannel.values()) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  const readRows: { userId: string; channelId: string; lastReadAt: Date }[] = [];
  for (const [userId, channelUnreads] of Object.entries(unreadTargets)) {
    for (const [channelId, unreadCount] of Object.entries(channelUnreads)) {
      const channelMessages = topLevelByChannel.get(channelId) ?? [];
      const totalMessages = channelMessages.length;

      let lastReadAt: Date;
      if (unreadCount >= totalMessages) {
        // All messages are unread — set cursor to epoch
        lastReadAt = new Date(0);
      } else {
        // cursorIndex = totalMessages - unreadCount - 1
        const cursorIndex = totalMessages - unreadCount - 1;
        const cursorMsg = channelMessages[cursorIndex];
        if (!cursorMsg) throw new Error(`No message at index ${cursorIndex} for ${channelId}`);
        lastReadAt = cursorMsg.createdAt;
      }

      readRows.push({ userId, channelId, lastReadAt });
    }
  }

  if (readRows.length > 0) {
    await db.insert(channelReads).values(readRows);
  }
  console.log(`  ${readRows.length} channel reads`);

  // 9. Scheduled messages — seed demo schedules
  console.log("Seeding scheduled messages...");
  await db.delete(scheduledMessages);

  const tomorrow9am = new Date();
  tomorrow9am.setDate(tomorrow9am.getDate() + 1);
  tomorrow9am.setHours(9, 0, 0, 0);

  const tomorrow830am = new Date();
  tomorrow830am.setDate(tomorrow830am.getDate() + 1);
  tomorrow830am.setHours(8, 30, 0, 0);

  const scheduledDefs = [
    {
      agentId: "michael",
      triggerAt: tomorrow9am,
      prompt: "Good morning! Start the day by posting an enthusiastic greeting in #general. Comment on something happening this week.",
      targetChannelId: "general",
    },
    {
      agentId: "dwight",
      triggerAt: tomorrow830am,
      prompt: "Post your daily security briefing in #general. Report on any suspicious activity, check fire exits, and remind everyone about safety protocols.",
      targetChannelId: "general",
    },
  ];

  await db.insert(scheduledMessages).values(scheduledDefs);
  console.log(`  ${scheduledDefs.length} scheduled messages`);

  // Summary
  const counts = {
    agents: agentRows.length,
    channels: channelRows.length,
    members: memberRows.length,
    messages: messageDefs.length + threadReplyDefs.length,
    reactions: reactionRows.length,
    memoryBlocks: memoryBlockDefs.length,
    channelReads: readRows.length,
    scheduledMessages: scheduledDefs.length,
  };
  console.log("\nSeed complete:", counts);

  // Verify with a quick count query
  const [agentCount] = await db.select({ count: sql<number>`count(*)::int` }).from(agents);
  const [msgCount] = await db.select({ count: sql<number>`count(*)::int` }).from(messages);
  console.log(`Verification — agents: ${agentCount?.count}, messages: ${msgCount?.count}`);

  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
