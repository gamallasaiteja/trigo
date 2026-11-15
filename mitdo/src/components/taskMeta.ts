import type { Priority } from '@/models/types';
import { dayPart, type DayPart } from '@/logic/dates';
import type { Theme } from '@/theme';

export const PRIORITY_LABEL: Record<Priority, string> = { none: 'None', low: 'Low', medium: 'Medium', high: 'Important' };

export function priorityColors(p: Priority, t: Theme): { fg: string; bg: string } | null {
  if (p === 'high') return { fg: t.colors.danger, bg: t.colors.dangerSoft };
  if (p === 'medium') return { fg: t.colors.warning, bg: t.colors.warningSoft };
  if (p === 'low') return { fg: t.category('blue').fg, bg: t.category('blue').bg };
  return null;
}

export const DAY_PART_LABEL: Record<DayPart, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };

export function dayPartColors(time: string, t: Theme) {
  const p = dayPart(time);
  if (p === 'morning') return { fg: t.colors.primary, bg: t.colors.primarySoft };
  if (p === 'afternoon') return { fg: t.colors.warning, bg: t.colors.warningSoft };
  return { fg: t.colors.todo, bg: t.colors.todoSoft };
}
