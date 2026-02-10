import type { ThreadReply } from '@/types';

function t(daysAgo: number, hour: number, min: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

export const threads: Record<string, ThreadReply[]> = {
  // Michael's big announcement thread (#general gen-3)
  'gen-3': [
    { id: 'gen-3-r1', parentMessageId: 'gen-3', userId: 'jim', text: "Please tell me it's not another movie Monday.", timestamp: t(2, 9, 10), reactions: [{ emoji: '😂', userIds: ['pam'] }] },
    { id: 'gen-3-r2', parentMessageId: 'gen-3', userId: 'dwight', text: 'I hope it\'s a promotion announcement. I\'ve been preparing my "Assistant Regional Manager" acceptance speech.', timestamp: t(2, 9, 12), reactions: [] },
    { id: 'gen-3-r3', parentMessageId: 'gen-3', userId: 'pam', text: "Last time he had a 'big announcement' it was that he learned how to make espresso.", timestamp: t(2, 9, 15), reactions: [{ emoji: '☕', userIds: ['jim', 'oscar'] }] },
  ],

  // Fridge cleanup thread (#general gen-7)
  'gen-7': [
    { id: 'gen-7-r1', parentMessageId: 'gen-7', userId: 'kevin', text: "Can I at least keep my M&Ms in there? They're organized by color.", timestamp: t(2, 10, 35), reactions: [] },
    { id: 'gen-7-r2', parentMessageId: 'gen-7', userId: 'pam', text: "Kevin, your M&Ms are fine. I'm talking about the unlabeled containers that have been there since March.", timestamp: t(2, 10, 40), reactions: [{ emoji: '👍', userIds: ['angela'] }] },
  ],

  // Jim's sales deal thread (#sales sal-1)
  'sal-1': [
    { id: 'sal-1-r1', parentMessageId: 'sal-1', userId: 'michael', text: "That's my boy! Drinks on me tonight! (just kidding you're paying)", timestamp: t(2, 10, 10), reactions: [{ emoji: '😂', userIds: ['jim'] }] },
    { id: 'sal-1-r2', parentMessageId: 'sal-1', userId: 'dwight', text: "I want it on record that I softened them up with my initial pitch. Jim just closed what I started.", timestamp: t(2, 10, 15), reactions: [] },
  ],

  // Angela's committee meeting thread (#party-planning pp-1)
  'pp-1': [
    { id: 'pp-1-r1', parentMessageId: 'pp-1', userId: 'phyllis', text: "Can we push it to 3:30? I have a call with Bob Vance at 3.", timestamp: t(2, 8, 10), reactions: [] },
    { id: 'pp-1-r2', parentMessageId: 'pp-1', userId: 'angela', text: "No. 3 PM means 3 PM. Bob Vance can wait.", timestamp: t(2, 8, 12), reactions: [] },
    { id: 'pp-1-r3', parentMessageId: 'pp-1', userId: 'kevin', text: "Will there be snacks at the meeting?", timestamp: t(2, 8, 15), reactions: [{ emoji: '🍪', userIds: ['kevin'] }] },
  ],

  // Pretzel Day thread (#announcements ann-1)
  'ann-1': [
    { id: 'ann-1-r1', parentMessageId: 'ann-1', userId: 'stanley', text: "I have been waiting for this day for 364 days. I have cleared my schedule.", timestamp: t(3, 9, 5), reactions: [{ emoji: '🥨', userIds: ['kevin', 'michael'] }] },
    { id: 'ann-1-r2', parentMessageId: 'ann-1', userId: 'kevin', text: "Stanley and I are forming an alliance to be first in line.", timestamp: t(3, 9, 10), reactions: [] },
  ],

  // Creed's turtle thread (#random ran-2)
  'ran-2': [
    { id: 'ran-2-r1', parentMessageId: 'ran-2', userId: 'jim', text: "Creed, you can't just claim a random turtle.", timestamp: t(2, 13, 5), reactions: [] },
    { id: 'ran-2-r2', parentMessageId: 'ran-2', userId: 'creed', text: "In the '60s I claimed a lot more than turtles. Chancellor stays.", timestamp: t(2, 13, 10), reactions: [{ emoji: '😂', userIds: ['jim', 'kevin'] }] },
  ],
};

export function getThreadReplies(parentMessageId: string): ThreadReply[] {
  return threads[parentMessageId] ?? [];
}
