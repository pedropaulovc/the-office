import type { UnreadCounts } from '@/types';

export const unreadCounts: UnreadCounts = {
  michael: {
    'sales': 3,
    'party-planning': 5,
    'random': 2,
    'dm-michael-toby': 1,
    'management': 2,
  },
  jim: {
    'general': 4,
    'announcements': 2,
    'dm-jim-andy': 1,
    'dm-jim-dwight': 2,
    'management': 1,
  },
  dwight: {
    'general': 2,
    'random': 3,
    'party-planning': 4,
    'dm-dwight-angela': 1,
  },
  pam: {
    'general': 3,
    'party-planning': 2,
  },
  ryan: {
    'random': 1,
    'announcements': 3,
  },
  stanley: {
    'sales': 2,
  },
  kevin: {
    'general': 1,
    'party-planning': 3,
    'accounting': 4,
  },
  angela: {
    'party-planning': 1,
    'accounting': 2,
  },
  oscar: {
    'general': 2,
    'accounting': 3,
  },
  andy: {
    'sales': 1,
    'random': 2,
  },
  toby: {
    'general': 5,
    'management': 3,
  },
  creed: {
    'random': 1,
  },
  kelly: {
    'party-planning': 2,
    'random': 1,
  },
  phyllis: {
    'sales': 1,
    'party-planning': 3,
  },
  meredith: {
    'party-planning': 1,
  },
  darryl: {
    'general': 2,
    'random': 1,
  },
};

export function getUnreadCount(userId: string, channelOrDmId: string): number {
  return unreadCounts[userId]?.[channelOrDmId] ?? 0;
}
