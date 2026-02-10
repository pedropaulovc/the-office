import type { Channel } from '@/types';

export const channels: Channel[] = [
  {
    id: 'general',
    name: 'general',
    kind: 'public',
    topic: 'Company-wide announcements and work-based matters',
    memberIds: ['michael', 'jim', 'dwight', 'pam', 'ryan', 'stanley', 'kevin', 'angela', 'oscar', 'andy', 'toby', 'creed', 'kelly', 'phyllis', 'meredith', 'darryl'],
  },
  {
    id: 'sales',
    name: 'sales',
    kind: 'public',
    topic: 'Sales team discussions and lead tracking',
    memberIds: ['michael', 'jim', 'dwight', 'stanley', 'andy', 'phyllis'],
  },
  {
    id: 'party-planning',
    name: 'party-planning',
    kind: 'public',
    topic: 'Party Planning Committee — Angela Martin, Chair',
    memberIds: ['angela', 'phyllis', 'pam', 'kelly', 'meredith', 'kevin', 'oscar'],
  },
  {
    id: 'announcements',
    name: 'announcements',
    kind: 'public',
    topic: 'Official announcements from management',
    memberIds: ['michael', 'jim', 'dwight', 'pam', 'ryan', 'stanley', 'kevin', 'angela', 'oscar', 'andy', 'toby', 'creed', 'kelly', 'phyllis', 'meredith', 'darryl'],
  },
  {
    id: 'random',
    name: 'random',
    kind: 'public',
    topic: 'Non-work banter and water cooler conversation',
    memberIds: ['michael', 'jim', 'dwight', 'pam', 'ryan', 'kevin', 'andy', 'creed', 'kelly', 'darryl'],
  },
  {
    id: 'accounting',
    name: 'accounting',
    kind: 'private',
    topic: 'Accounting department — budgets, expenses, and reconciliation',
    memberIds: ['kevin', 'oscar', 'angela'],
  },
  {
    id: 'management',
    name: 'management',
    kind: 'private',
    topic: 'Management discussions — HR, promotions, and office policy',
    memberIds: ['michael', 'jim', 'toby'],
  },
];

export function getChannel(id: string): Channel | undefined {
  return channels.find(c => c.id === id);
}
