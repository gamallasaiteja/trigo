/**
 * Optional example data so a new user can explore Mitdo's progress screens.
 * Only ever loaded when the user taps "Load example tasks" in Profile.
 * Generated through the same task operations the app uses for real tasks.
 */
import type { AppData, DateKey, Priority, RepeatRule, Task, TaskDraft } from '@/models/types';
import { addDays, combine, diffDays } from './dates';
import * as ops from './taskOps';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface SeriesSpec {
  title: string;
  cat: string;
  time: string | null;
  repeat: RepeatRule;
  remind?: number;
  priority?: Priority;
  /** Base completion probability for past occurrences. */
  p: number;
}

const SERIES: SeriesSpec[] = [
  { title: 'Morning prayer', cat: 'cat_worship', time: '05:30', repeat: { frequency: 'daily' }, remind: 0, p: 0.9 },
  { title: 'Make the bed', cat: 'cat_home', time: '07:00', repeat: { frequency: 'daily' }, p: 0.85 },
  { title: 'Morning workout', cat: 'cat_health', time: '06:30', repeat: { frequency: 'weekdays' }, remind: 15, priority: 'medium', p: 0.75 },
  { title: 'Water the plants', cat: 'cat_home', time: '08:00', repeat: { frequency: 'custom', days: [1, 4] }, p: 0.8 },
  { title: 'Drink 2L of water', cat: 'cat_health', time: null, repeat: { frequency: 'daily' }, p: 0.7 },
  { title: 'Evening walk', cat: 'cat_health', time: '18:30', repeat: { frequency: 'daily' }, remind: 5, p: 0.55 },
  { title: 'Read 20 pages', cat: 'cat_learning', time: '21:00', repeat: { frequency: 'daily' }, remind: 0, p: 0.45 },
  { title: 'Plan the week', cat: 'cat_personal', time: '19:00', repeat: { frequency: 'weekly' }, remind: 0, p: 0.8 },
];

interface OneOff {
  title: string;
  cat: string;
  offset: number;
  time: string | null;
  priority: Priority;
  desc?: string;
}

const ONE_OFFS: OneOff[] = [
  { title: 'Finish project proposal', cat: 'cat_work', offset: 0, time: '10:00', priority: 'high', desc: 'Final review of budget section, then send to the team.' },
  { title: 'Review & edit slides', cat: 'cat_work', offset: 0, time: '15:30', priority: 'medium' },
  { title: 'Research competitors', cat: 'cat_work', offset: -1, time: '11:00', priority: 'medium' },
  { title: 'Prepare presentation', cat: 'cat_work', offset: 1, time: '14:00', priority: 'high' },
  { title: 'Clean the kitchen', cat: 'cat_home', offset: 0, time: '13:00', priority: 'none' },
  { title: 'Online course: Module 3', cat: 'cat_learning', offset: 2, time: '20:00', priority: 'low' },
  { title: 'Call mum', cat: 'cat_personal', offset: 3, time: '17:00', priority: 'none' },
  { title: 'Take out the trash', cat: 'cat_home', offset: 0, time: '20:30', priority: 'none' },
];

const HISTORY_DAYS = 27;

export function buildSampleData(input: AppData, today: DateKey, nowDate: Date): AppData {
  const rand = rng(42);
  const iso = nowDate.toISOString();
  const catIds = new Set(input.categories.map((c) => c.id));
  const cat = (id: string) => (catIds.has(id) ? id : input.categories[0].id);
  const start = addDays(today, -HISTORY_DAYS);
  let data: AppData = input;

  for (const s of SERIES) {
    const draft: TaskDraft = {
      title: s.title,
      description: '',
      categoryId: cat(s.cat),
      dueDate: start,
      scheduledTime: s.time,
      reminder: s.remind !== undefined && s.time ? { offsetMinutes: s.remind } : null,
      repeat: s.repeat,
      priority: s.priority ?? 'none',
    };
    data = ops.createTask(data, draft, today, iso);
  }
  for (const o of ONE_OFFS) {
    data = ops.createTask(
      data,
      {
        title: o.title,
        description: o.desc ?? '',
        categoryId: cat(o.cat),
        dueDate: addDays(today, o.offset),
        scheduledTime: o.time,
        reminder: o.time ? { offsetMinutes: 15 } : null,
        repeat: { frequency: 'none' },
        priority: o.priority,
      },
      today,
      iso,
    );
  }

  const nowTime = `${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}`;
  const newIds = new Set(data.tasks.filter((t) => !input.tasks.some((x) => x.id === t.id)).map((t) => t.id));

  const tasks = data.tasks.map((t) => {
    if (!newIds.has(t.id)) return t;
    const spec = SERIES.find((s) => s.title === t.title);
    // Backdate creation to when it was planned.
    const createdAt = combine(t.originalDate < today ? t.originalDate : today, '00:05').toISOString();
    let task: Task = { ...t, createdAt, updatedAt: createdAt, history: [{ type: 'created', at: createdAt }] };
    const past = t.dueDate < today;
    const isToday = t.dueDate === today;
    const timePassed = t.scheduledTime ? t.scheduledTime <= nowTime : nowDate.getHours() >= 18;

    if (spec && (past || (isToday && timePassed))) {
      const weekend = [0, 6].includes(combine(t.dueDate, '12:00').getDay());
      // Gradual improvement over time, weekends a little weaker.
      const age = (HISTORY_DAYS - diffDays(t.dueDate, today)) / HISTORY_DAYS;
      const p = Math.min(0.97, spec.p + age * 0.12 - (weekend ? 0.12 : 0));
      if (spec.cat === 'cat_learning' && past && rand() < 0.2) {
        // Occasionally pushed to the next day first.
        const at = combine(t.dueDate, '22:30').toISOString();
        const to = addDays(t.dueDate, 1);
        task = {
          ...task,
          history: [...task.history, { type: 'rescheduled', at, from: `${t.dueDate} ${t.scheduledTime}`, to: `${to} ${t.scheduledTime}` }],
          dueDate: to < today ? to : t.dueDate,
        };
      }
      if (rand() < p) {
        const doneAt = combine(task.dueDate, task.scheduledTime ?? '12:00');
        doneAt.setMinutes(doneAt.getMinutes() + Math.floor(rand() * 40));
        const at = (doneAt > nowDate ? nowDate : doneAt).toISOString();
        task = { ...task, status: 'completed', completedAt: at, updatedAt: at, history: [...task.history, { type: 'status_changed', at, from: 'todo', to: 'completed' }] };
      }
    } else if (!spec && t.dueDate <= today) {
      // One-offs: one done, one in progress, the rest open.
      if (t.title === 'Research competitors' || t.title === 'Finish project proposal') {
        const at = iso;
        task = { ...task, status: 'in_progress', startedAt: at, updatedAt: at, history: [...task.history, { type: 'status_changed', at, from: 'todo', to: 'in_progress' }] };
      } else if (t.title === 'Clean the kitchen' && timePassed) {
        const at = iso;
        task = { ...task, status: 'completed', completedAt: at, updatedAt: at, history: [...task.history, { type: 'status_changed', at, from: 'todo', to: 'completed' }] };
      }
    }
    return task;
  });

  return { ...data, tasks };
}

