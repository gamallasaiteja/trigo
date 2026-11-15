import type { DateKey, RepeatRule, Task, TaskSeries, Timestamp } from '@/models/types';
import { createId } from '@/utils/id';
import { addDays, diffDays, weekday } from './dates';

/** How far ahead recurring occurrences are created. */
export const MATERIALIZE_AHEAD_DAYS = 14;
/** Missed days are back-filled at most this far (keeps a long absence bounded). */
export const MAX_BACKFILL_DAYS = 60;

export function isRecurring(rule: RepeatRule): boolean {
  return rule.frequency !== 'none';
}

/** Does a rule that started on `startDate` produce an occurrence on `date`? */
export function occursOn(rule: RepeatRule, startDate: DateKey, date: DateKey): boolean {
  if (date < startDate) return false;
  const wd = weekday(date);
  switch (rule.frequency) {
    case 'none':
      return date === startDate;
    case 'daily':
      return true;
    case 'weekdays':
      return wd >= 1 && wd <= 5;
    case 'weekends':
      return wd === 0 || wd === 6;
    case 'weekly':
      return diffDays(startDate, date) % 7 === 0;
    case 'custom': {
      const days = rule.days && rule.days.length > 0 ? rule.days : [weekday(startDate)];
      return days.includes(wd);
    }
  }
}

/** First date on or after `from` that the rule produces (searches up to a year). */
export function nextOccurrence(rule: RepeatRule, startDate: DateKey, from: DateKey): DateKey | null {
  let d = from < startDate ? startDate : from;
  for (let i = 0; i < 366; i++, d = addDays(d, 1)) {
    if (occursOn(rule, startDate, d)) return d;
  }
  return null;
}

export function occurrenceFromSeries(series: TaskSeries, date: DateKey, now: Timestamp): Task {
  return {
    id: createId('t_'),
    seriesId: series.id,
    title: series.title,
    description: series.description,
    categoryId: series.categoryId,
    dueDate: date,
    originalDate: date,
    scheduledTime: series.scheduledTime,
    reminder: series.reminder ? { ...series.reminder } : null,
    repeat: { ...series.repeat },
    priority: series.priority,
    status: 'todo',
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    snoozedUntil: null,
    history: [{ type: 'created', at: now }],
  };
}

/**
 * Create any missing dated occurrences for every series up to `today + ahead`.
 * Returns new arrays only when something changed.
 */
export function materializeAll(
  series: TaskSeries[],
  tasks: Task[],
  today: DateKey,
  now: Timestamp,
  ahead = MATERIALIZE_AHEAD_DAYS,
): { series: TaskSeries[]; tasks: Task[]; changed: boolean } {
  const horizon = addDays(today, ahead);
  const existing = new Set(tasks.filter((t) => t.seriesId).map((t) => `${t.seriesId}|${t.originalDate}`));
  const created: Task[] = [];
  let changed = false;

  const nextSeries = series.map((s) => {
    const end = s.endDate && s.endDate < horizon ? s.endDate : horizon;
    let from = s.materializedThrough ? addDays(s.materializedThrough, 1) : s.startDate;
    if (from < s.startDate) from = s.startDate;
    const earliest = addDays(today, -MAX_BACKFILL_DAYS);
    if (from < earliest) from = earliest;
    if (from > end) return s;

    const skipped = new Set(s.skippedDates);
    for (let d = from; d <= end; d = addDays(d, 1)) {
      if (!occursOn(s.repeat, s.startDate, d)) continue;
      if (skipped.has(d) || existing.has(`${s.id}|${d}`)) continue;
      created.push(occurrenceFromSeries(s, d, now));
    }
    changed = true;
    return { ...s, materializedThrough: end };
  });

  if (!changed) return { series, tasks, changed: false };
  return { series: nextSeries, tasks: created.length ? [...tasks, ...created] : tasks, changed: true };
}
