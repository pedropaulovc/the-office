import type { User } from '@/types';

export const SWITCHABLE_USER_IDS = [
  'michael', 'jim', 'dwight', 'pam', 'ryan', 'stanley',
  'kevin', 'angela', 'oscar', 'andy', 'toby', 'creed',
  'kelly', 'phyllis', 'meredith', 'darryl',
] as const;

export const users: Record<string, User> = {
  michael: {
    id: 'michael',
    displayName: 'Michael Scott',
    title: 'Regional Manager',
    avatarColor: '#4A90D9',
    presence: 'active',
    status: { emoji: '🎉', text: "World's Best Boss" },
  },
  jim: {
    id: 'jim',
    displayName: 'Jim Halpert',
    title: 'Sales Representative',
    avatarColor: '#50C878',
    presence: 'active',
  },
  dwight: {
    id: 'dwight',
    displayName: 'Dwight Schrute',
    title: 'Assistant Regional Manager',
    avatarColor: '#D4A017',
    presence: 'active',
    status: { emoji: '🥬', text: 'Beet harvest season' },
  },
  pam: {
    id: 'pam',
    displayName: 'Pam Beesly',
    title: 'Receptionist',
    avatarColor: '#E8A0BF',
    presence: 'active',
  },
  ryan: {
    id: 'ryan',
    displayName: 'Ryan Howard',
    title: 'Temp',
    avatarColor: '#FF6B6B',
    presence: 'away',
    status: { emoji: '🔥', text: 'WUPHF.com' },
  },
  stanley: {
    id: 'stanley',
    displayName: 'Stanley Hudson',
    title: 'Sales Representative',
    avatarColor: '#8B4513',
    presence: 'away',
  },
  kevin: {
    id: 'kevin',
    displayName: 'Kevin Malone',
    title: 'Accountant',
    avatarColor: '#90EE90',
    presence: 'active',
  },
  angela: {
    id: 'angela',
    displayName: 'Angela Martin',
    title: 'Head of Accounting',
    avatarColor: '#DDA0DD',
    presence: 'active',
    status: { emoji: '🐱', text: 'Sprinkles forever' },
  },
  oscar: {
    id: 'oscar',
    displayName: 'Oscar Martinez',
    title: 'Accountant',
    avatarColor: '#20B2AA',
    presence: 'active',
  },
  andy: {
    id: 'andy',
    displayName: 'Andy Bernard',
    title: 'Sales Representative',
    avatarColor: '#FF8C00',
    presence: 'active',
    status: { emoji: '🎵', text: 'Rit dit dit di doo' },
  },
  toby: {
    id: 'toby',
    displayName: 'Toby Flenderson',
    title: 'HR Representative',
    avatarColor: '#A9A9A9',
    presence: 'active',
  },
  creed: {
    id: 'creed',
    displayName: 'Creed Bratton',
    title: 'Quality Assurance',
    avatarColor: '#708090',
    presence: 'offline',
  },
  kelly: {
    id: 'kelly',
    displayName: 'Kelly Kapoor',
    title: 'Customer Service',
    avatarColor: '#FF69B4',
    presence: 'active',
    status: { emoji: '💅', text: 'Shopping' },
  },
  phyllis: {
    id: 'phyllis',
    displayName: 'Phyllis Vance',
    title: 'Sales Representative',
    avatarColor: '#DB7093',
    presence: 'away',
  },
  meredith: {
    id: 'meredith',
    displayName: 'Meredith Palmer',
    title: 'Supplier Relations',
    avatarColor: '#CD853F',
    presence: 'offline',
  },
  darryl: {
    id: 'darryl',
    displayName: 'Darryl Philbin',
    title: 'Warehouse Foreman',
    avatarColor: '#4682B4',
    presence: 'active',
  },
};

export function getUser(id: string): User {
  return users[id] ?? {
    id,
    displayName: 'Unknown User',
    title: '',
    avatarColor: '#999',
    presence: 'offline' as const,
  };
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
