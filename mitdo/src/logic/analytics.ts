/**
 * Progress and completion analytics, computed from recorded task data only.
 * A task counts towards the day it is currently due. Rates only include
 * tasks due on or before today: future plans are never counted as misses.
 */
import type { Category, DateKey, Task } from '@/models/types';
import { addDays, dateRange, endOfMonth, startOfMonth, startOfWeek } from './dates';

export interface StatusCounts {
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
}

export function countStatuses(tasks: Task[]): StatusCounts {
  const c: StatusCounts = { total: tasks.length, completed: 0, inProgress: 0, todo: 0 };
  for (const t of tasks) {
    if (t.status === 'completed') c.completed++;
    else if (t.status === 'in_progress') c.inProgress++;
    else c.todo++;
  }
  return c;
}

/** Completion ratio 0..1, or null when there is nothing to measure. */
export function rate(c: Pick<StatusCounts, 'total' | 'completed'>): number | null {
  return c.total === 0 ? null : c.completed / c.total;
}

export const pct = (r: number | null) => (r === null ? 0 : Math.round(r * 100));

export function tasksOn(tasks: Task[], date: DateKey): Task[] {
  return tasks.filter((t) => t.dueDate === date);
}

export function tasksBetween(tasks: Task[], from: DateKey, to: DateKey): Task[] {
  return tasks.filter((t) => t.dueDate >= from && t.dueDate <= to);
}

/**
 * A one-off task whose date has passed without being completed. It stays
 * visible ("carried forward") until it is completed or rescheduled.
 */
export function isOverdue(t: Task, today: DateKey): boolean {
  return t.status !== 'completed' && t.dueDate < today && !t.seriesId;
}

/**
 * A past occurrence of a recurring task that wasn't completed. It is kept on
 * its own date (and counts as not completed in analytics) rather than piling
 * up as overdue, because the next occurrence replaces it.
 */
export function isMissed(t: Task, today: DateKey): boolean {
  return t.status !== 'completed' && t.dueDate < today && !!t.seriesId;
}

export function overdueTasks(tasks: Task[], today: DateKey): Task[] {
  return tasks.filter((t) => isOverdue(t, today)).sort(compareTasks);
}

/** Sort: by date, then timed tasks by time, then untimed, then title. */
export function compareTasks(a: Task, b: Task): number {
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  if (a.scheduledTime && b.scheduledTime && a.scheduledTime !== b.scheduledTime) return a.scheduledTime < b.scheduledTime ? -1 : 1;
  if (a.scheduledTime && !b.scheduledTime) return -1;
  if (!a.scheduledTime && b.scheduledTime) return 1;
  return a.title.localeCompare(b.title);
}

// ---------- Calendar ----------

export type DayState = 'empty' | 'done' | 'partial' | 'missed' | 'open' | 'planned';

export interface CalendarDay {
  date: DateKey;
  inMonth: boolean;
  isToday: boolean;
  counts: StatusCounts;
  state: DayState;
}

export function dayState(counts: StatusCounts, date: DateKey, today: DateKey): DayState {
  if (counts.total === 0) return 'empty';
  if (counts.completed === counts.total) return 'done';
  if (date > today) return 'planned';
  if (counts.completed > 0 || counts.inProgress > 0) return 'partial';
  return date < today ? 'missed' : 'open';
}

export function monthCalendar(tasks: Task[], month: DateKey, weekStart: 0 | 1, today: DateKey): CalendarDay[][] {
  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const gridStart = startOfWeek(first, weekStart);
  const byDate = new Map<DateKey, Task[]>();
  for (const t of tasks) {
    const list = byDate.get(t.dueDate);
    if (list) list.push(t);
    else byDate.set(t.dueDate, [t]);
  }
  const weeks: CalendarDay[][] = [];
  let d = gridStart;
  while (d <= last) {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++, d = addDays(d, 1)) {
      const counts = countStatuses(byDate.get(d) ?? []);
      week.push({
        date: d,
        inMonth: d >= first && d <= last,
        isToday: d === today,
        counts,
        state: dayState(counts, d, today),
      });
    }
    weeks.push(week);
  }
  return weeks;
}

// ---------- Summaries ----------

export interface CategoryStat {
  category: Category;
  counts: StatusCounts;
  rate: number | null;
}

export function categoryStats(tasks: Task[], categories: Category[]): CategoryStat[] {
  return categories.map((category) => {
    const counts = countStatuses(tasks.filter((t) => t.categoryId === category.id));
    return { category, counts, rate: rate(counts) };
  });
}

export interface PerformanceSummary {
  overallRate: number | null;
  weekRate: number | null;
  monthRate: number | null;
  totalCompleted: number;
  dueSoFar: number;
  mostConsistent: CategoryStat | null;
  currentStreak: number;
}

/** Minimum due tasks before a category can be called "most consistent". */
export const MIN_CATEGORY_SAMPLE = 3;

/** Consecutive days (ending today, or yesterday if today isn't finished) where every due task was completed. */
export function currentStreak(tasks: Task[], today: DateKey): number {
  const byDate = new Map<DateKey, StatusCounts>();
  const dates = new Set(tasks.map((t) => t.dueDate));
  for (const d of dates) byDate.set(d, countStatuses(tasksOn(tasks, d)));
  let streak = 0;
  let d = today;
  const todayCounts = byDate.get(today);
  if (!todayCounts || todayCounts.completed < todayCounts.total) d = addDays(today, -1);
  for (let i = 0; i < 400; i++, d = addDays(d, -1)) {
    const c = byDate.get(d);
    if (!c || c.total === 0) {
      // Days without any tasks don't break a streak, but don't extend it either.
      if (![...dates].some((x) => x < d)) break;
      continue;
    }
    if (c.completed < c.total) break;
    streak++;
  }
  return streak;
}

export function performanceSummary(tasks: Task[], categories: Category[], today: DateKey, weekStart: 0 | 1): PerformanceSummary {
  const due = tasks.filter((t) => t.dueDate <= today);
  const week = tasksBetween(due, startOfWeek(today, weekStart), today);
  const month = tasksBetween(due, startOfMonth(today), today);
  const cats = categoryStats(due, categories).filter((c) => c.counts.total >= MIN_CATEGORY_SAMPLE);
  cats.sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0) || b.counts.total - a.counts.total);
  return {
    overallRate: rate(countStatuses(due)),
    weekRate: rate(countStatuses(week)),
    monthRate: rate(countStatuses(month)),
    totalCompleted: tasks.filter((t) => t.status === 'completed').length,
    dueSoFar: due.length,
    mostConsistent: cats[0] && (cats[0].rate ?? 0) > 0 ? cats[0] : null,
    currentStreak: currentStreak(due, today),
  };
}

export interface DayBar {
  date: DateKey;
  counts: StatusCounts;
  rate: number | null;
}

/** Last `n` days ending today. */
export function recentDays(tasks: Task[], today: DateKey, n = 7): DayBar[] {
  return dateRange(addDays(today, -(n - 1)), today).map((date) => {
    const counts = countStatuses(tasksOn(tasks, date));
    return { date, counts, rate: rate(counts) };
  });
}
