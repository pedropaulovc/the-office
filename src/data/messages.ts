import type { Message } from '@/types';

// Helper to make timestamps relative to "today"
function t(daysAgo: number, hour: number, min: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

export const messages: Message[] = [
  // ============ #general ============
  { id: 'gen-1', channelId: 'general', userId: 'michael', text: 'Good morning everyone! It is a beautiful day at Dunder Mifflin, and I just want to say... I love this company.', timestamp: t(2, 9, 0), reactions: [{ emoji: '❤️', userIds: ['pam', 'kevin'] }], threadReplyCount: 0 },
  { id: 'gen-2', channelId: 'general', userId: 'stanley', text: "It's Monday, Michael.", timestamp: t(2, 9, 2), reactions: [], threadReplyCount: 0 },
  { id: 'gen-3', channelId: 'general', userId: 'michael', text: "And what better day to celebrate the gift of employment! Everyone, conference room in 5 minutes. I have a big announcement.", timestamp: t(2, 9, 3), reactions: [{ emoji: '😬', userIds: ['jim', 'pam', 'oscar'] }], threadReplyCount: 3, threadParticipantIds: ['jim', 'dwight', 'pam'] },
  { id: 'gen-4', channelId: 'general', userId: 'dwight', text: "I'll prepare the conference room. Everyone should be seated by rank.", timestamp: t(2, 9, 4), reactions: [], threadReplyCount: 0 },
  { id: 'gen-5', channelId: 'general', userId: 'jim', text: 'What rank system are we using today, Dwight?', timestamp: t(2, 9, 5), reactions: [{ emoji: '😂', userIds: ['pam', 'kevin', 'oscar'] }], threadReplyCount: 0 },
  { id: 'gen-6', channelId: 'general', userId: 'dwight', text: "Schrute family hierarchy. Obviously. It's based on beet yield per acre.", timestamp: t(2, 9, 6), reactions: [{ emoji: '🥬', userIds: ['creed'] }], threadReplyCount: 0 },
  { id: 'gen-7', channelId: 'general', userId: 'pam', text: "Reminder: the kitchen fridge will be cleaned out on Friday. Please label your food. Kevin, this means you.", timestamp: t(2, 10, 30), reactions: [{ emoji: '👍', userIds: ['oscar', 'angela'] }], threadReplyCount: 2, threadParticipantIds: ['kevin', 'pam'] },
  { id: 'gen-8', channelId: 'general', userId: 'kevin', text: "But my chili needs time to marinate! It's a Malone family recipe.", timestamp: t(2, 10, 32), reactions: [{ emoji: '🍲', userIds: ['michael'] }], threadReplyCount: 0 },
  { id: 'gen-9', channelId: 'general', userId: 'creed', text: "I've been storing something in that fridge for three years. Nobody touch it.", timestamp: t(2, 11, 0), reactions: [{ emoji: '😨', userIds: ['pam', 'jim', 'angela'] }], threadReplyCount: 0 },
  { id: 'gen-10', channelId: 'general', userId: 'angela', text: 'This is exactly why we need stricter kitchen policies. I have drafted a 12-page proposal.', timestamp: t(2, 11, 5), reactions: [], threadReplyCount: 0 },
  { id: 'gen-11', channelId: 'general', userId: 'oscar', text: 'Angela, a 12-page kitchen policy seems a bit excessive.', timestamp: t(2, 11, 7), reactions: [{ emoji: '💯', userIds: ['jim', 'stanley'] }], threadReplyCount: 0 },
  { id: 'gen-12', channelId: 'general', userId: 'toby', text: 'Hey everyone, just a reminder that the annual safety training is coming up next week. Please sign up on the sheet by my desk.', timestamp: t(1, 9, 0), reactions: [], threadReplyCount: 0 },
  { id: 'gen-13', channelId: 'general', userId: 'michael', text: "Nobody cares, Toby. Why are you the way that you are?", timestamp: t(1, 9, 1), reactions: [{ emoji: '😂', userIds: ['jim', 'dwight', 'ryan'] }], threadReplyCount: 0 },
  { id: 'gen-14', channelId: 'general', userId: 'kelly', text: 'OMG has anyone seen the new episode of The Bachelor last night?? I literally cannot even right now. 💀', timestamp: t(1, 10, 15), reactions: [{ emoji: '💀', userIds: ['ryan'] }], threadReplyCount: 0 },
  { id: 'gen-15', channelId: 'general', userId: 'darryl', text: "Heads up — forklift maintenance is happening this afternoon. Warehouse will be loud. Try not to send Michael down here.", timestamp: t(1, 11, 0), reactions: [{ emoji: '😂', userIds: ['jim', 'pam'] }, { emoji: '🏗️', userIds: ['michael'] }], threadReplyCount: 0 },
  { id: 'gen-16', channelId: 'general', userId: 'michael', text: "I drove the forklift ONE time, Darryl. And I'd argue I was the best forklift driver this office has ever seen.", timestamp: t(1, 11, 3), reactions: [{ emoji: '🤦', userIds: ['darryl', 'jim', 'pam'] }], threadReplyCount: 0 },
  { id: 'gen-17', channelId: 'general', userId: 'andy', text: 'Hey everyone! I just want to say I am PUMPED to be here today. Nard Dog is ready to sell some paper! 🐕', timestamp: t(0, 8, 45), reactions: [{ emoji: '🐕', userIds: ['michael'] }], threadReplyCount: 0 },
  { id: 'gen-18', channelId: 'general', userId: 'michael', text: "That's what she said! ...wait, that doesn't work there. Or does it? 🤔", timestamp: t(0, 9, 0), reactions: [{ emoji: '😂', userIds: ['jim', 'kevin', 'andy'] }, { emoji: '🤦', userIds: ['pam', 'oscar', 'angela'] }], threadReplyCount: 0 },

  // ============ #sales ============
  { id: 'sal-1', channelId: 'sales', userId: 'jim', text: "Just closed the Lackawanna County deal. 50 boxes monthly, 2-year contract.", timestamp: t(2, 10, 0), reactions: [{ emoji: '🎉', userIds: ['michael', 'phyllis', 'pam'] }], threadReplyCount: 2, threadParticipantIds: ['michael', 'dwight'] },
  { id: 'sal-2', channelId: 'sales', userId: 'dwight', text: "That was MY lead, Jim. I had them on the hook for 75 boxes.", timestamp: t(2, 10, 5), reactions: [], threadReplyCount: 0 },
  { id: 'sal-3', channelId: 'sales', userId: 'jim', text: "Dwight, you literally threw a beet at their CFO.", timestamp: t(2, 10, 6), reactions: [{ emoji: '😂', userIds: ['michael', 'andy', 'phyllis'] }], threadReplyCount: 0 },
  { id: 'sal-4', channelId: 'sales', userId: 'dwight', text: "It was a GIFT, Jim. In Schrute culture, offering a beet is the highest form of business respect.", timestamp: t(2, 10, 7), reactions: [{ emoji: '🥬', userIds: ['creed'] }], threadReplyCount: 0 },
  { id: 'sal-5', channelId: 'sales', userId: 'michael', text: "Great work, team! We are crushing it this quarter. Pizza party when we hit target!", timestamp: t(2, 10, 30), reactions: [{ emoji: '🍕', userIds: ['kevin', 'jim', 'andy'] }], threadReplyCount: 0 },
  { id: 'sal-6', channelId: 'sales', userId: 'stanley', text: "Are we done here? I have a crossword to finish.", timestamp: t(2, 10, 35), reactions: [], threadReplyCount: 0 },
  { id: 'sal-7', channelId: 'sales', userId: 'phyllis', text: "I have a lead from Bob Vance, Vance Refrigeration. They need custom letterhead.", timestamp: t(1, 9, 30), reactions: [], threadReplyCount: 0 },
  { id: 'sal-8', channelId: 'sales', userId: 'michael', text: "Bob Vance! Love that guy. Phyllis, tell Bob I said what's up and that I'm available for couples game night anytime.", timestamp: t(1, 9, 35), reactions: [], threadReplyCount: 0 },
  { id: 'sal-9', channelId: 'sales', userId: 'andy', text: "Q3 numbers are looking good, gang. The Nard Dog is bringing home the bacon! Beer me five! 🖐️", timestamp: t(1, 14, 0), reactions: [{ emoji: '🖐️', userIds: ['michael'] }], threadReplyCount: 0 },
  { id: 'sal-10', channelId: 'sales', userId: 'jim', text: "Quick update — Harper Collins wants to renegotiate. Meeting Thursday at 2.", timestamp: t(0, 9, 15), reactions: [{ emoji: '👍', userIds: ['michael', 'stanley'] }], threadReplyCount: 0 },
  { id: 'sal-11', channelId: 'sales', userId: 'dwight', text: "I will be at that meeting. I will also bring my katana in case negotiations get heated.", timestamp: t(0, 9, 17), reactions: [{ emoji: '⚔️', userIds: ['creed'] }, { emoji: '😬', userIds: ['jim', 'phyllis'] }], threadReplyCount: 0 },
  { id: 'sal-12', channelId: 'sales', userId: 'jim', text: "Please don't bring the katana, Dwight.", timestamp: t(0, 9, 18), reactions: [], threadReplyCount: 0 },

  // ============ #party-planning ============
  { id: 'pp-1', channelId: 'party-planning', userId: 'angela', text: "Committee meeting at 3 PM today. Attendance is MANDATORY. Agenda: Halloween decorations budget.", timestamp: t(2, 8, 0), reactions: [], threadReplyCount: 3, threadParticipantIds: ['phyllis', 'kevin', 'angela'] },
  { id: 'pp-2', channelId: 'party-planning', userId: 'phyllis', text: "I was thinking we could do a harvest theme this year? Bob and I saw the cutest pumpkin display—", timestamp: t(2, 8, 5), reactions: [], threadReplyCount: 0 },
  { id: 'pp-3', channelId: 'party-planning', userId: 'angela', text: "Phyllis, we are NOT doing harvest theme. We're doing Nutcracker theme. I already ordered the decorations.", timestamp: t(2, 8, 6), reactions: [{ emoji: '😑', userIds: ['phyllis', 'pam'] }], threadReplyCount: 0 },
  { id: 'pp-4', channelId: 'party-planning', userId: 'kelly', text: "Can we do a Beyoncé theme?? That would be SO iconic.", timestamp: t(2, 9, 0), reactions: [{ emoji: '💃', userIds: ['kelly'] }], threadReplyCount: 0 },
  { id: 'pp-5', channelId: 'party-planning', userId: 'angela', text: "No.", timestamp: t(2, 9, 1), reactions: [], threadReplyCount: 0 },
  { id: 'pp-6', channelId: 'party-planning', userId: 'kevin', text: "Can we at least make sure there's enough cake this time? Last party I only got one slice.", timestamp: t(2, 9, 15), reactions: [], threadReplyCount: 0 },
  { id: 'pp-7', channelId: 'party-planning', userId: 'angela', text: "Kevin, you took FOUR slices last time. I was counting.", timestamp: t(2, 9, 16), reactions: [{ emoji: '😂', userIds: ['oscar', 'pam'] }], threadReplyCount: 0 },
  { id: 'pp-8', channelId: 'party-planning', userId: 'pam', text: "I can make some decorations if we need them! I've been working on my watercolors.", timestamp: t(1, 10, 0), reactions: [{ emoji: '🎨', userIds: ['jim'] }], threadReplyCount: 0 },
  { id: 'pp-9', channelId: 'party-planning', userId: 'angela', text: "Fine, Pam. But they have to match my color scheme: eggshell, ivory, and cream. NO other colors.", timestamp: t(1, 10, 5), reactions: [{ emoji: '😐', userIds: ['pam'] }], threadReplyCount: 0 },
  { id: 'pp-10', channelId: 'party-planning', userId: 'oscar', text: "Angela, those are all the same color.", timestamp: t(1, 10, 7), reactions: [{ emoji: '💯', userIds: ['jim', 'kevin'] }], threadReplyCount: 0 },
  { id: 'pp-11', channelId: 'party-planning', userId: 'angela', text: "They are NOT the same color, Oscar. You clearly have no eye for design.", timestamp: t(1, 10, 8), reactions: [], threadReplyCount: 0 },
  { id: 'pp-12', channelId: 'party-planning', userId: 'meredith', text: "Can we just make sure there's an open bar this time?", timestamp: t(1, 14, 0), reactions: [{ emoji: '🍺', userIds: ['creed'] }], threadReplyCount: 0 },

  // ============ #announcements ============
  { id: 'ann-1', channelId: 'announcements', userId: 'michael', text: "📢 ATTENTION EVERYONE! This Friday is Pretzel Day! The pretzel guy is coming back!", timestamp: t(3, 9, 0), reactions: [{ emoji: '🥨', userIds: ['stanley', 'kevin', 'pam', 'jim', 'andy'] }, { emoji: '🎉', userIds: ['michael', 'kelly'] }], threadReplyCount: 2, threadParticipantIds: ['stanley', 'kevin'] },
  { id: 'ann-2', channelId: 'announcements', userId: 'stanley', text: "Did someone say Pretzel Day?", timestamp: t(3, 9, 1), reactions: [{ emoji: '😍', userIds: ['stanley'] }], threadReplyCount: 0 },
  { id: 'ann-3', channelId: 'announcements', userId: 'toby', text: "Just a reminder that we need to complete our quarterly compliance training by end of month. Link is in your email.", timestamp: t(2, 8, 0), reactions: [], threadReplyCount: 0 },
  { id: 'ann-4', channelId: 'announcements', userId: 'michael', text: "Toby, nobody reads your emails. I delete them as a matter of principle.", timestamp: t(2, 8, 5), reactions: [{ emoji: '💀', userIds: ['jim', 'ryan'] }], threadReplyCount: 0 },
  { id: 'ann-5', channelId: 'announcements', userId: 'dwight', text: "🚨 FIRE DRILL will be conducted this Thursday at 2 PM. This is NOT a test. I mean, it IS a test, but treat it like it's real. Your lives depend on it.", timestamp: t(1, 7, 30), reactions: [{ emoji: '🔥', userIds: ['ryan'] }, { emoji: '😰', userIds: ['kevin', 'angela'] }], threadReplyCount: 0 },
  { id: 'ann-6', channelId: 'announcements', userId: 'oscar', text: "Dwight, the last fire drill you conducted involved an actual fire in the building.", timestamp: t(1, 7, 35), reactions: [{ emoji: '😂', userIds: ['jim', 'pam', 'kelly'] }], threadReplyCount: 0 },
  { id: 'ann-7', channelId: 'announcements', userId: 'michael', text: "🏆 Employee of the Month goes to... EVERYONE! Because you're all special. Except Toby.", timestamp: t(0, 9, 0), reactions: [{ emoji: '🏆', userIds: ['andy', 'kelly'] }, { emoji: '😢', userIds: ['toby'] }], threadReplyCount: 0 },

  // ============ #random ============
  { id: 'ran-1', channelId: 'random', userId: 'kevin', text: "Does anyone know if the vending machine takes $5 bills? Asking for a friend. The friend is me.", timestamp: t(2, 12, 0), reactions: [{ emoji: '😂', userIds: ['jim', 'pam'] }], threadReplyCount: 0 },
  { id: 'ran-2', channelId: 'random', userId: 'creed', text: "I found a turtle in the parking lot. He's mine now. His name is Chancellor.", timestamp: t(2, 13, 0), reactions: [{ emoji: '🐢', userIds: ['kevin', 'kelly'] }, { emoji: '😨', userIds: ['angela'] }], threadReplyCount: 2, threadParticipantIds: ['jim', 'creed'] },
  { id: 'ran-3', channelId: 'random', userId: 'andy', text: "🎵 I'm just a small town girl, living in a lonely world... 🎵 Who wants to do karaoke tonight?", timestamp: t(2, 15, 0), reactions: [{ emoji: '🎤', userIds: ['michael', 'kelly'] }], threadReplyCount: 0 },
  { id: 'ran-4', channelId: 'random', userId: 'jim', text: "Just found out Dwight has a custom license plate that says 'BEETS'. Not surprised at all.", timestamp: t(1, 11, 30), reactions: [{ emoji: '😂', userIds: ['pam', 'andy', 'kevin'] }], threadReplyCount: 0 },
  { id: 'ran-5', channelId: 'random', userId: 'dwight', text: "FALSE. It says 'BEET ME'. Which is a challenge.", timestamp: t(1, 11, 32), reactions: [{ emoji: '😂', userIds: ['jim', 'pam', 'michael'] }], threadReplyCount: 0 },
  { id: 'ran-6', channelId: 'random', userId: 'kelly', text: "Ryan just liked my Instagram post from 3 weeks ago. Do you think that means something?? 🤔💕", timestamp: t(1, 14, 0), reactions: [{ emoji: '💔', userIds: ['pam'] }], threadReplyCount: 0 },
  { id: 'ran-7', channelId: 'random', userId: 'ryan', text: "It was an accident.", timestamp: t(1, 14, 2), reactions: [{ emoji: '💀', userIds: ['jim', 'kevin'] }], threadReplyCount: 0 },
  { id: 'ran-8', channelId: 'random', userId: 'michael', text: "Movie quote game! I'll start: 'You miss 100% of the shots you don't take. - Wayne Gretzky' - Michael Scott", timestamp: t(0, 10, 0), reactions: [{ emoji: '🏒', userIds: ['andy'] }, { emoji: '🤦', userIds: ['jim', 'oscar'] }], threadReplyCount: 0 },
  { id: 'ran-9', channelId: 'random', userId: 'darryl', text: "Michael, that's not a movie quote.", timestamp: t(0, 10, 2), reactions: [], threadReplyCount: 0 },
  { id: 'ran-10', channelId: 'random', userId: 'michael', text: "It's from the movie of my LIFE, Darryl.", timestamp: t(0, 10, 3), reactions: [{ emoji: '😂', userIds: ['jim', 'pam', 'andy', 'kevin'] }], threadReplyCount: 0 },

  // ============ #accounting ============
  { id: 'acc-1', channelId: 'accounting', userId: 'angela', text: 'Q3 expense reports are due by end of day Friday. No exceptions. Kevin, that includes you.', timestamp: t(2, 9, 0), reactions: [], threadReplyCount: 0 },
  { id: 'acc-2', channelId: 'accounting', userId: 'kevin', text: "I'm working on it. Math is hard when the numbers are big.", timestamp: t(2, 9, 5), reactions: [{ emoji: '🤦', userIds: ['angela'] }], threadReplyCount: 0 },
  { id: 'acc-3', channelId: 'accounting', userId: 'oscar', text: "Kevin, you literally just have to add up the receipts. I made you a spreadsheet template.", timestamp: t(2, 9, 10), reactions: [], threadReplyCount: 0 },
  { id: 'acc-4', channelId: 'accounting', userId: 'kevin', text: "The spreadsheet has too many columns. Can we just do one big column?", timestamp: t(2, 9, 15), reactions: [{ emoji: '😂', userIds: ['oscar'] }], threadReplyCount: 0 },
  { id: 'acc-5', channelId: 'accounting', userId: 'angela', text: "I found a $200 discrepancy in the petty cash. Someone explain. NOW.", timestamp: t(1, 10, 0), reactions: [], threadReplyCount: 2, threadParticipantIds: ['kevin', 'angela'] },
  { id: 'acc-6', channelId: 'accounting', userId: 'kevin', text: "It wasn't me. Although I did buy a lot of vending machine snacks last week.", timestamp: t(1, 10, 5), reactions: [], threadReplyCount: 0 },
  { id: 'acc-7', channelId: 'accounting', userId: 'oscar', text: "I ran the numbers again. The discrepancy is from Michael's 'business lunch' at Benihana. He charged it to office supplies.", timestamp: t(1, 10, 15), reactions: [{ emoji: '😑', userIds: ['angela'] }], threadReplyCount: 0 },
  { id: 'acc-8', channelId: 'accounting', userId: 'angela', text: "I am filing a formal complaint. This is the third time this quarter.", timestamp: t(1, 10, 20), reactions: [], threadReplyCount: 0 },

  // ============ #management ============
  { id: 'mgt-1', channelId: 'management', userId: 'michael', text: "Team, I've been thinking about promotions. Everybody deserves one, right? Is that how it works?", timestamp: t(2, 14, 0), reactions: [], threadReplyCount: 0 },
  { id: 'mgt-2', channelId: 'management', userId: 'toby', text: "Michael, we have a budget and a formal review process. We can't just promote everyone.", timestamp: t(2, 14, 5), reactions: [], threadReplyCount: 0 },
  { id: 'mgt-3', channelId: 'management', userId: 'michael', text: "Toby, you are the silent killer. Go back to the annex.", timestamp: t(2, 14, 6), reactions: [{ emoji: '😬', userIds: ['jim'] }], threadReplyCount: 0 },
  { id: 'mgt-4', channelId: 'management', userId: 'jim', text: "We should probably discuss the open sales position first. I have a few candidates in mind.", timestamp: t(1, 11, 0), reactions: [{ emoji: '👍', userIds: ['toby'] }], threadReplyCount: 0 },
  { id: 'mgt-5', channelId: 'management', userId: 'toby', text: "Agreed. I've put together a shortlist. Also, reminder that annual reviews start next month.", timestamp: t(1, 11, 10), reactions: [], threadReplyCount: 0 },
  { id: 'mgt-6', channelId: 'management', userId: 'michael', text: "I'll handle the reviews personally. I already have superlatives picked out. Jim, you're 'Most Likely to Be Jim'.", timestamp: t(0, 9, 30), reactions: [{ emoji: '😂', userIds: ['jim'] }], threadReplyCount: 0 },

  // ============ DM: michael-jim ============
  { id: 'dm-mj-1', channelId: 'dm-michael-jim', userId: 'michael', text: "Jim! My main man. My number two. My right hand. Want to get lunch?", timestamp: t(1, 11, 0), reactions: [], threadReplyCount: 0 },
  { id: 'dm-mj-2', channelId: 'dm-michael-jim', userId: 'jim', text: "Sure Michael, where were you thinking?", timestamp: t(1, 11, 5), reactions: [], threadReplyCount: 0 },
  { id: 'dm-mj-3', channelId: 'dm-michael-jim', userId: 'michael', text: "Chili's! The new Awesome Blossom is calling my name. 🌺", timestamp: t(1, 11, 6), reactions: [{ emoji: '😂', userIds: ['jim'] }], threadReplyCount: 0 },
  { id: 'dm-mj-4', channelId: 'dm-michael-jim', userId: 'jim', text: "Michael, Chili's banned you.", timestamp: t(1, 11, 8), reactions: [], threadReplyCount: 0 },
  { id: 'dm-mj-5', channelId: 'dm-michael-jim', userId: 'michael', text: "That was a MISUNDERSTANDING. I was just showing everyone the Dundies.", timestamp: t(1, 11, 9), reactions: [], threadReplyCount: 0 },
  { id: 'dm-mj-6', channelId: 'dm-michael-jim', userId: 'jim', text: "How about Cooper's? They have good sandwiches.", timestamp: t(1, 11, 10), reactions: [], threadReplyCount: 0 },
  { id: 'dm-mj-7', channelId: 'dm-michael-jim', userId: 'michael', text: "Deal! You're paying though. Boss privileges. 😎", timestamp: t(1, 11, 11), reactions: [], threadReplyCount: 0 },

  // ============ DM: michael-dwight ============
  { id: 'dm-md-1', channelId: 'dm-michael-dwight', userId: 'dwight', text: "Michael, I've prepared my quarterly beet harvest report. Permission to present it in the conference room?", timestamp: t(1, 8, 0), reactions: [], threadReplyCount: 0 },
  { id: 'dm-md-2', channelId: 'dm-michael-dwight', userId: 'michael', text: "Dwight, nobody wants to see your beet report.", timestamp: t(1, 8, 5), reactions: [], threadReplyCount: 0 },
  { id: 'dm-md-3', channelId: 'dm-michael-dwight', userId: 'dwight', text: "It has GRAPHS, Michael. Color-coded graphs.", timestamp: t(1, 8, 6), reactions: [], threadReplyCount: 0 },
  { id: 'dm-md-4', channelId: 'dm-michael-dwight', userId: 'michael', text: "Fine, you have 3 minutes. And NO bringing actual beets into the conference room again.", timestamp: t(1, 8, 10), reactions: [], threadReplyCount: 0 },
  { id: 'dm-md-5', channelId: 'dm-michael-dwight', userId: 'dwight', text: "Thank you, Michael. Also, I wanted to discuss promoting me to Assistant Regional Manager officially.", timestamp: t(1, 8, 15), reactions: [], threadReplyCount: 0 },
  { id: 'dm-md-6', channelId: 'dm-michael-dwight', userId: 'michael', text: "You are the Assistant TO the Regional Manager, Dwight. We've been over this.", timestamp: t(1, 8, 20), reactions: [], threadReplyCount: 0 },

  // ============ DM: michael-toby ============
  { id: 'dm-mt-1', channelId: 'dm-michael-toby', userId: 'toby', text: "Hi Michael, just following up on the harassment complaint from last week. We need to schedule a meeting.", timestamp: t(2, 9, 0), reactions: [], threadReplyCount: 0 },
  { id: 'dm-mt-2', channelId: 'dm-michael-toby', userId: 'michael', text: "No.", timestamp: t(2, 9, 30), reactions: [], threadReplyCount: 0 },
  { id: 'dm-mt-3', channelId: 'dm-michael-toby', userId: 'toby', text: "Michael, it's required by corporate policy.", timestamp: t(2, 10, 0), reactions: [], threadReplyCount: 0 },
  { id: 'dm-mt-4', channelId: 'dm-michael-toby', userId: 'michael', text: "If I had a gun with two bullets and I was in a room with Hitler, Bin Laden, and Toby, I'd shoot Toby twice.", timestamp: t(2, 10, 5), reactions: [], threadReplyCount: 0 },
  { id: 'dm-mt-5', channelId: 'dm-michael-toby', userId: 'toby', text: "I'm going to pretend I didn't see that. The meeting is Thursday at 10.", timestamp: t(2, 10, 10), reactions: [], threadReplyCount: 0 },

  // ============ DM: michael-ryan ============
  { id: 'dm-mr-1', channelId: 'dm-michael-ryan', userId: 'michael', text: "Ryan! My temp! Have you checked out my screenplay yet? It's called 'Threat Level Midnight'.", timestamp: t(1, 15, 0), reactions: [], threadReplyCount: 0 },
  { id: 'dm-mr-2', channelId: 'dm-michael-ryan', userId: 'ryan', text: "I'll look at it when I have time, Michael.", timestamp: t(1, 15, 30), reactions: [], threadReplyCount: 0 },
  { id: 'dm-mr-3', channelId: 'dm-michael-ryan', userId: 'michael', text: "You're going to love it. There's a role for you. You play the temp who saves the world.", timestamp: t(1, 15, 31), reactions: [], threadReplyCount: 0 },
  { id: 'dm-mr-4', channelId: 'dm-michael-ryan', userId: 'ryan', text: "Great.", timestamp: t(1, 15, 35), reactions: [], threadReplyCount: 0 },

  // ============ DM: jim-pam ============
  { id: 'dm-jp-1', channelId: 'dm-jim-pam', userId: 'jim', text: "Pam. Dwight just put a bobblehead of himself on my desk. This is escalating.", timestamp: t(1, 10, 0), reactions: [], threadReplyCount: 0 },
  { id: 'dm-jp-2', channelId: 'dm-jim-pam', userId: 'pam', text: "😂 Are you serious?? Where did he even get a custom bobblehead?", timestamp: t(1, 10, 2), reactions: [], threadReplyCount: 0 },
  { id: 'dm-jp-3', channelId: 'dm-jim-pam', userId: 'jim', text: "I don't want to know. But I'm putting it in jello. The plan is already in motion.", timestamp: t(1, 10, 3), reactions: [{ emoji: '😂', userIds: ['pam'] }], threadReplyCount: 0 },
  { id: 'dm-jp-4', channelId: 'dm-jim-pam', userId: 'pam', text: "You need to let me watch when he finds it. I'll bring popcorn.", timestamp: t(1, 10, 5), reactions: [], threadReplyCount: 0 },
  { id: 'dm-jp-5', channelId: 'dm-jim-pam', userId: 'jim', text: "Deal. Also, dinner tonight? I was thinking Italian.", timestamp: t(1, 10, 6), reactions: [], threadReplyCount: 0 },
  { id: 'dm-jp-6', channelId: 'dm-jim-pam', userId: 'pam', text: "Yes! Alfredo's Pizza Cafe, NOT Pizza by Alfredo. There's a big difference.", timestamp: t(1, 10, 7), reactions: [{ emoji: '❤️', userIds: ['jim'] }], threadReplyCount: 0 },
  { id: 'dm-jp-7', channelId: 'dm-jim-pam', userId: 'jim', text: "Obviously. One is a hot circle of garbage.", timestamp: t(1, 10, 8), reactions: [], threadReplyCount: 0 },

  // ============ DM: jim-dwight ============
  { id: 'dm-jd-1', channelId: 'dm-jim-dwight', userId: 'dwight', text: "Jim, I know you moved my desk 2 inches to the left. I measured.", timestamp: t(2, 14, 0), reactions: [], threadReplyCount: 0 },
  { id: 'dm-jd-2', channelId: 'dm-jim-dwight', userId: 'jim', text: "Dwight, I have no idea what you're talking about.", timestamp: t(2, 14, 5), reactions: [], threadReplyCount: 0 },
  { id: 'dm-jd-3', channelId: 'dm-jim-dwight', userId: 'dwight', text: "I have photographic evidence. I take daily photos of my desk perimeter.", timestamp: t(2, 14, 6), reactions: [], threadReplyCount: 0 },
  { id: 'dm-jd-4', channelId: 'dm-jim-dwight', userId: 'jim', text: "That's... very normal behavior.", timestamp: t(2, 14, 7), reactions: [], threadReplyCount: 0 },
  { id: 'dm-jd-5', channelId: 'dm-jim-dwight', userId: 'dwight', text: "Also, STOP putting my stapler in jello. That's the third one this month.", timestamp: t(0, 9, 0), reactions: [], threadReplyCount: 0 },
  { id: 'dm-jd-6', channelId: 'dm-jim-dwight', userId: 'jim', text: "I told you, I don't know what happened to your stapler.", timestamp: t(0, 9, 5), reactions: [], threadReplyCount: 0 },

  // ============ DM: jim-andy ============
  { id: 'dm-ja-1', channelId: 'dm-jim-andy', userId: 'andy', text: "Big Tuna! Want to join my a cappella group? We need a baritone.", timestamp: t(1, 13, 0), reactions: [], threadReplyCount: 0 },
  { id: 'dm-ja-2', channelId: 'dm-jim-andy', userId: 'jim', text: "I'm going to pass, Andy. But thanks for thinking of me.", timestamp: t(1, 13, 10), reactions: [], threadReplyCount: 0 },
  { id: 'dm-ja-3', channelId: 'dm-jim-andy', userId: 'andy', text: "Your loss, Tuna. We're doing a set of all Maroon 5 songs converted to a cappella. It's going to be legendary.", timestamp: t(1, 13, 15), reactions: [], threadReplyCount: 0 },
  { id: 'dm-ja-4', channelId: 'dm-jim-andy', userId: 'jim', text: "I'm sure it will be.", timestamp: t(1, 13, 20), reactions: [], threadReplyCount: 0 },

  // ============ DM: dwight-angela ============
  { id: 'dm-da-1', channelId: 'dm-dwight-angela', userId: 'dwight', text: "Monkey, the new barn cat is adjusting well. She caught 4 mice yesterday.", timestamp: t(1, 19, 0), reactions: [], threadReplyCount: 0 },
  { id: 'dm-da-2', channelId: 'dm-dwight-angela', userId: 'angela', text: "That's wonderful D. I knew she'd be a good fit for the farm. How are the other cats?", timestamp: t(1, 19, 10), reactions: [], threadReplyCount: 0 },
  { id: 'dm-da-3', channelId: 'dm-dwight-angela', userId: 'dwight', text: "Garbage is thriving. Mr. Ash is asserting dominance over the hay loft territory. Milky Way is... still weird.", timestamp: t(1, 19, 15), reactions: [{ emoji: '🐱', userIds: ['angela'] }], threadReplyCount: 0 },
  { id: 'dm-da-4', channelId: 'dm-dwight-angela', userId: 'angela', text: "I wish I could visit this weekend but I have a cat show in Philadelphia. Sprinkles Jr. is competing in 3 categories.", timestamp: t(1, 19, 20), reactions: [], threadReplyCount: 0 },
  { id: 'dm-da-5', channelId: 'dm-dwight-angela', userId: 'dwight', text: "Understood. I'll send photos of the beet harvest progress. This year's yield will be MAGNIFICENT.", timestamp: t(1, 19, 25), reactions: [{ emoji: '❤️', userIds: ['angela'] }], threadReplyCount: 0 },
];

export function getMessagesForChannel(channelId: string): Message[] {
  return messages.filter(m => m.channelId === channelId);
}
