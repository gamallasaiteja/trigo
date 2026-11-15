/**
 * Pure planning of which local notifications should exist right now.
 * Kept separate from expo-notifications so it can be unit tested.
 */
import type { AppData, Task } from '@/models/types';
import { addDays, combine, toDateKey } from '@/logic/dates';

export interface PlannedNotification {
  id: string;
  date: Date;
  title: string;
  body: string;
  data: { kind: 'task' | 'summary'; taskId?: string };
}

/** iOS keeps at most 64 pending local notifications per app. Stay below that. */
export const MAX_SCHEDULED = 60;
export const PLAN_DAYS = 7;

export function reminderDate(task: Task): Date | null {
  if (!task.reminder || !task.scheduledTime) return null;
  const d = combine(task.dueDate, task.scheduledTime);
  d.setMinutes(d.getMinutes() - task.reminder.offsetMinutes);
  return d;
}

function reminderCopy(task: Task): { title: string; body: string } {
  const off = task.reminder?.offsetMinutes ?? 0;
  if (off === 0) return { title: `Time for: ${task.title}`, body: 'You planned this for now. One step at a time. You’ve got this!' };
  const when = off >= 60 && off % 60 === 0 ? `${off / 60} hour${off === 60 ? '' : 's'}` : `${off} minutes`;
  return { title: `Coming up: ${task.title}`, body: `Starts in ${when}. Don’t forget!` };
}

export function planNotifications(data: AppData, now: Date = new Date()): PlannedNotification[] {
  const s = data.settings;
  if (!s.notificationsEnabled) return [];
  const horizon = new Date(now.getTime() + PLAN_DAYS * 86_400_000);
  const out: PlannedNotification[] = [];

  for (const t of data.tasks) {
    if (t.status === 'completed') continue;
    const snoozed = t.snoozedUntil ? new Date(t.snoozedUntil) : null;
    if (snoozed && snoozed > now && snoozed <= horizon) {
      out.push({
        id: `task-${t.id}`,
        date: snoozed,
        title: `Reminder: ${t.title}`,
        body: 'You snoozed this earlier. Ready now?',
        data: { kind: 'task', taskId: t.id },
      });
      continue;
    }
    const at = reminderDate(t);
    if (at && at > now && at <= horizon) {
      out.push({ id: `task-${t.id}`, date: at, ...reminderCopy(t), data: { kind: 'task', taskId: t.id } });
    }
  }

  if (s.dailySummaryEnabled) {
    const today = toDateKey(now);
    for (let i = 0; i < PLAN_DAYS; i++) {
      const day = addDays(today, i);
      const at = combine(day, s.dailySummaryTime);
      if (at <= now) continue;
      const count = data.tasks.filter((t) => t.dueDate === day && t.status !== 'completed').length;
      if (count === 0) continue;
      const name = s.userName ? `, ${s.userName}` : '';
      out.push({
        id: `summary-${day}`,
        date: at,
        title: `Good morning${name}! ☀️`,
        body: `You have ${count} important ${count === 1 ? 'thing' : 'things'} to accomplish today.`,
        data: { kind: 'summary' },
      });
    }
  }

  out.sort((a, b) => a.date.getTime() - b.date.getTime());
  return out.slice(0, MAX_SCHEDULED);
}
