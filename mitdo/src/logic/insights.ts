/**
 * Rule-based insights. Each rule only fires when the recorded data is large
 * enough to support it, so nothing here is invented. Thresholds are explicit.
 */
import type { Category, DateKey, Task } from '@/models/types';
import { countStatuses, isOverdue, rate, tasksBetween, currentStreak } from './analytics';
import { addDays, dayPart, diffDays, isWeekend, startOfWeek } from './dates';

export type InsightTone = 'positive' | 'neutral' | 'attention';

export interface Insight {
  id: string;
  emoji: string;
  text: string;
  tone: InsightTone;
}

export const INSIGHT_RULES = {
  /** Minimum tasks in each group being compared. */
  minGroup: 4,
  /** Minimum tasks due this week for the weekly rate. */
  minWeek: 3,
  /** Rate difference (0..1) before we call one group better. */
  minGap: 0.15,
  /** Rate difference vs last week before we call it a change. */
  minWeekChange: 0.05,
  /** Reschedules in a category (last 30 days) before calling it "postponed". */
  minPostpones: 2,
  lookbackDays: 30,
  minStreak: 3,
};

const P = (r: number) => `${Math.round(r * 100)}%`;
const PART_LABEL = { morning: 'morning', afternoon: 'afternoon', evening: 'evening' } as const;

export function generateInsights(tasks: Task[], categories: Category[], today: DateKey, weekStart: 0 | 1): Insight[] {
  const R = INSIGHT_RULES;
  const out: Insight[] = [];
  const due = tasks.filter((t) => t.dueDate <= today);
  // Comparisons use finished days only, so today's not-yet-done tasks never count as misses.
  const closed = tasks.filter((t) => t.dueDate < today);
  const yesterday = addDays(today, -1);

  // 1. This week so far (finished days), and change vs. the same span last week.
  const weekStartKey = startOfWeek(today, weekStart);
  const thisWeek = countStatuses(tasksBetween(closed, weekStartKey, yesterday));
  if (thisWeek.total >= R.minWeek) {
    const r = rate(thisWeek)!;
    out.push({
      id: 'week-rate',
      emoji: r >= 0.7 ? '🎉' : '📅',
      text: `So far this week you completed ${P(r)} of your planned tasks (${thisWeek.completed} of ${thisWeek.total}).`,
      tone: r >= 0.7 ? 'positive' : 'neutral',
    });
    const span = diffDays(weekStartKey, yesterday);
    const lastStart = addDays(weekStartKey, -7);
    const last = countStatuses(tasksBetween(closed, lastStart, addDays(lastStart, span)));
    if (last.total >= R.minWeek) {
      const diff = r - rate(last)!;
      if (Math.abs(diff) >= R.minWeekChange) {
        out.push(
          diff > 0
            ? { id: 'week-trend', emoji: '📈', text: `Your consistency improved by ${P(diff)} compared with the same days last week.`, tone: 'positive' }
            : { id: 'week-trend', emoji: '📉', text: `Your completion rate is ${P(-diff)} lower than on the same days last week.`, tone: 'attention' },
        );
      }
    }
  }

  const recent = tasksBetween(closed, addDays(today, -R.lookbackDays), yesterday);

  // 2. Weekdays vs weekends.
  const wk = countStatuses(recent.filter((t) => !isWeekend(t.dueDate)));
  const we = countStatuses(recent.filter((t) => isWeekend(t.dueDate)));
  if (wk.total >= R.minGroup && we.total >= R.minGroup) {
    const a = rate(wk)!;
    const b = rate(we)!;
    if (Math.abs(a - b) >= R.minGap) {
      const better = a > b ? 'weekdays' : 'weekends';
      out.push({
        id: 'weekday-weekend',
        emoji: '🗓️',
        text: `You are most consistent on ${better} (${P(Math.max(a, b))} vs ${P(Math.min(a, b))}).`,
        tone: 'neutral',
      });
    }
  }

  // 3. Time of day.
  const timed = recent.filter((t) => t.scheduledTime);
  const parts = (['morning', 'afternoon', 'evening'] as const)
    .map((p) => ({ p, c: countStatuses(timed.filter((t) => dayPart(t.scheduledTime!) === p)) }))
    .filter((x) => x.c.total >= R.minGroup)
    .map((x) => ({ ...x, r: rate(x.c)! }))
    .sort((a, b) => b.r - a.r);
  if (parts.length >= 2 && parts[0].r - parts[parts.length - 1].r >= R.minGap) {
    out.push({
      id: 'day-part',
      emoji: parts[0].p === 'morning' ? '🌅' : parts[0].p === 'afternoon' ? '☀️' : '🌙',
      text: `Your ${PART_LABEL[parts[0].p]} tasks have a higher completion rate (${P(parts[0].r)}) than your ${PART_LABEL[parts[parts.length - 1].p]} tasks (${P(parts[parts.length - 1].r)}).`,
      tone: 'neutral',
    });
  }

  // 4. Most-postponed category (based on recorded reschedule events).
  const since = addDays(today, -(R.lookbackDays - 1));
  const postpones = new Map<string, number>();
  for (const t of tasks) {
    const n = t.history.filter((e) => e.type === 'rescheduled' && e.at.slice(0, 10) >= since && (e.to ?? '') > (e.from ?? '')).length;
    if (n) postpones.set(t.categoryId, (postpones.get(t.categoryId) ?? 0) + n);
  }
  const topPostponed = [...postpones.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topPostponed && topPostponed[1] >= R.minPostpones) {
    const cat = categories.find((c) => c.id === topPostponed[0]);
    if (cat) {
      out.push({
        id: 'postponed',
        emoji: '⏳',
        text: `You frequently postpone ${cat.name} tasks: ${topPostponed[1]} were moved to a later date in the last ${R.lookbackDays} days.`,
        tone: 'attention',
      });
    }
  }

  // 5. Strongest category.
  const catRates = categories
    .map((c) => ({ c, s: countStatuses(recent.filter((t) => t.categoryId === c.id)) }))
    .filter((x) => x.s.total >= R.minGroup)
    .map((x) => ({ ...x, r: rate(x.s)! }))
    .sort((a, b) => b.r - a.r);
  if (catRates.length >= 2 && catRates[0].r >= 0.6) {
    out.push({
      id: 'best-category',
      emoji: catRates[0].c.emoji,
      text: `${catRates[0].c.name} is your most reliable area: ${P(catRates[0].r)} completed in the last ${R.lookbackDays} days.`,
      tone: 'positive',
    });
  }

  // 6. Streak.
  const streak = currentStreak(due, today);
  if (streak >= R.minStreak) {
    out.push({ id: 'streak', emoji: '🔥', text: `${streak} days in a row with every planned task done. Keep moving!`, tone: 'positive' });
  }

  // 7. Overdue work (always factual).
  const overdue = tasks.filter((t) => isOverdue(t, today)).length;
  if (overdue > 0) {
    out.push({
      id: 'overdue',
      emoji: '📌',
      text: `${overdue} unfinished ${overdue === 1 ? 'task is' : 'tasks are'} past ${overdue === 1 ? 'its' : 'their'} date. Complete or reschedule ${overdue === 1 ? 'it' : 'them'} to keep your plan honest.`,
      tone: 'attention',
    });
  }

  return out;
}
