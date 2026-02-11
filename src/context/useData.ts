'use client';

import { useContext } from 'react';
import { DataContext } from './data-context-def';

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}
