import { createEmptyData } from '@/models/defaults';
import type { AppData, TaskDraft } from '@/models/types';

export const NOW = '2026-11-15T09:00:00.000Z';
export const TODAY = '2026-11-15'; // a Sunday

export function draft(overrides: Partial<TaskDraft> = {}): TaskDraft {
  return {
    title: 'Read 20 pages',
    description: '',
    categoryId: 'cat_learning',
    dueDate: TODAY,
    scheduledTime: '21:00',
    reminder: { offsetMinutes: 15 },
    repeat: { frequency: 'none' },
    priority: 'none',
    ...overrides,
  };
}

export function empty(): AppData {
  return createEmptyData();
}
