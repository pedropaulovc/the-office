import type { DirectMessage } from '@/types';

export const directMessages: DirectMessage[] = [
  // Michael's DMs
  { id: 'dm-michael-jim', participantIds: ['michael', 'jim'] },
  { id: 'dm-michael-dwight', participantIds: ['michael', 'dwight'] },
  { id: 'dm-michael-toby', participantIds: ['michael', 'toby'] },
  { id: 'dm-michael-ryan', participantIds: ['michael', 'ryan'] },
  // Jim's DMs
  { id: 'dm-jim-pam', participantIds: ['jim', 'pam'] },
  { id: 'dm-jim-dwight', participantIds: ['jim', 'dwight'] },
  { id: 'dm-jim-andy', participantIds: ['jim', 'andy'] },
  // Dwight's DMs
  { id: 'dm-dwight-angela', participantIds: ['dwight', 'angela'] },
];

export function getDmsForUser(userId: string): DirectMessage[] {
  return directMessages.filter(dm => dm.participantIds.includes(userId));
}

export function getDmOtherParticipant(dm: DirectMessage, currentUserId: string): string {
  return dm.participantIds.find(id => id !== currentUserId) ?? dm.participantIds[0];
}
