/**
 * Pure state transitions for tasks and series. Every function takes the
 * current `AppData` and returns a new `AppData`; nothing here touches storage,
 * notifications or React.
 */
import { FALLBACK_CATEGORY_ID } from '@/models/defaults';
import type {
  AppData,
  Category,
  DateKey,
  SeriesScope,
  Task,
  TaskDraft,
  TaskSeries,
  TaskStatus,
  TimeKey,
  Timestamp,
} from '@/models/types';
import { createId } from '@/utils/id';
import { addDays } from './dates';
import { isRecurring, materializeAll, nextOccurrence } from './recurrence';

const describeSlot = (date: DateKey, time: TimeKey | null) => (time ? `${date} ${time}` : date);

function seriesFromDraft(draft: TaskDraft, startDate: DateKey, now: Timestamp): TaskSeries {
  return {
    id: createId('s_'),
    title: draft.title.trim(),
    description: draft.description.trim(),
    categoryId: draft.categoryId,
    startDate,
    endDate: null,
    scheduledTime: draft.scheduledTime,
    reminder: draft.reminder,
    repeat: draft.repeat,
    priority: draft.priority,
    createdAt: now,
    updatedAt: now,
    materializedThrough: null,
    skippedDates: [],
  };
}

function taskFromDraft(draft: TaskDraft, now: Timestamp): Task {
  return {
    id: createId('t_'),
    seriesId: null,
    title: draft.title.trim(),
    description: draft.description.trim(),
    categoryId: draft.categoryId,
    dueDate: draft.dueDate,
    originalDate: draft.dueDate,
    scheduledTime: draft.scheduledTime,
    reminder: draft.reminder,
    repeat: { frequency: 'none' },
    priority: draft.priority,
    status: 'todo',
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    snoozedUntil: null,
    history: [{ type: 'created', at: now }],
  };
}

/** Make sure every series has its occurrences generated through the horizon. */
export function materialize(data: AppData, today: DateKey, now: Timestamp): AppData {
  const res = materializeAll(data.series, data.tasks, today, now);
  return res.changed ? { ...data, series: res.series, tasks: res.tasks } : data;
}

export function createTask(data: AppData, draft: TaskDraft, today: DateKey, now: Timestamp): AppData {
  if (!isRecurring(draft.repeat)) {
    return { ...data, tasks: [...data.tasks, taskFromDraft(draft, now)] };
  }
  // A recurring rule starts on the first matching day on/after the chosen date.
  const start = nextOccurrence(draft.repeat, draft.dueDate, draft.dueDate) ?? draft.dueDate;
  const series = seriesFromDraft(draft, start, now);
  return materialize({ ...data, series: [...data.series, series] }, today, now);
}

function updateTaskById(data: AppData, id: string, fn: (t: Task) => Task): AppData {
  return { ...data, tasks: data.tasks.map((t) => (t.id === id ? fn(t) : t)) };
}

export function setStatus(data: AppData, id: string, status: TaskStatus, now: Timestamp): AppData {
  return updateTaskById(data, id, (t) => {
    if (t.status === status) return t;
    return {
      ...t,
      status,
      updatedAt: now,
      startedAt: status === 'in_progress' ? (t.startedAt ?? now) : t.startedAt,
      completedAt: status === 'completed' ? now : null,
      snoozedUntil: status === 'completed' ? null : t.snoozedUntil,
      history: [...t.history, { type: 'status_changed', at: now, from: t.status, to: status }],
    };
  });
}

/** One-tap toggle: anything not done becomes done; done goes back to to-do. */
export function toggleComplete(data: AppData, id: string, now: Timestamp): AppData {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return data;
  return setStatus(data, id, task.status === 'completed' ? 'todo' : 'completed', now);
}

/** Move a single task to another date (and optionally time), keeping its history. */
export function reschedule(
  data: AppData,
  id: string,
  date: DateKey,
  time: TimeKey | null | undefined,
  now: Timestamp,
): AppData {
  return updateTaskById(data, id, (t) => {
    const nextTime = time === undefined ? t.scheduledTime : time;
    if (t.dueDate === date && t.scheduledTime === nextTime) return t;
    return {
      ...t,
      dueDate: date,
      scheduledTime: nextTime,
      snoozedUntil: null,
      updatedAt: now,
      history: [
        ...t.history,
        { type: 'rescheduled', at: now, from: describeSlot(t.dueDate, t.scheduledTime), to: describeSlot(date, nextTime) },
      ],
    };
  });
}

export function snooze(data: AppData, id: string, until: Timestamp, now: Timestamp): AppData {
  return updateTaskById(data, id, (t) => ({
    ...t,
    snoozedUntil: until,
    updatedAt: now,
    history: [...t.history, { type: 'snoozed', at: now, to: until }],
  }));
}

function applyDraftToTask(t: Task, draft: TaskDraft, now: Timestamp): Task {
  const moved = t.dueDate !== draft.dueDate || t.scheduledTime !== draft.scheduledTime;
  const history = [...t.history, { type: 'edited' as const, at: now }];
  if (moved) {
    history.push({
      type: 'rescheduled',
      at: now,
      from: describeSlot(t.dueDate, t.scheduledTime),
      to: describeSlot(draft.dueDate, draft.scheduledTime),
    });
  }
  return {
    ...t,
    title: draft.title.trim(),
    description: draft.description.trim(),
    categoryId: draft.categoryId,
    dueDate: draft.dueDate,
    scheduledTime: draft.scheduledTime,
    reminder: draft.reminder,
    priority: draft.priority,
    snoozedUntil: moved ? null : t.snoozedUntil,
    updatedAt: now,
    history,
  };
}

/**
 * Edit a task. For an occurrence of a recurring series, `scope` decides
 * whether only this occurrence changes or this and all future ones.
 * Completed history is never rewritten.
 */
export function updateTask(
  data: AppData,
  id: string,
  draft: TaskDraft,
  scope: SeriesScope,
  today: DateKey,
  now: Timestamp,
): AppData {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return data;

  // Single (non-recurring) task that the user turns into a recurring one.
  if (!task.seriesId) {
    if (!isRecurring(draft.repeat)) {
      return updateTaskById(data, id, (t) => applyDraftToTask(t, draft, now));
    }
    const series = seriesFromDraft(draft, draft.dueDate, now);
    series.materializedThrough = draft.dueDate; // this task already covers the first day
    const next = updateTaskById(data, id, (t) => ({
      ...applyDraftToTask(t, draft, now),
      seriesId: series.id,
      originalDate: draft.dueDate,
      repeat: draft.repeat,
    }));
    return materialize({ ...next, series: [...next.series, series] }, today, now);
  }

  if (scope === 'this') {
    return updateTaskById(data, id, (t) => applyDraftToTask(t, draft, now));
  }

  // scope === 'future': split the series at this occurrence.
  const old = data.series.find((s) => s.id === task.seriesId);
  if (!old) return updateTaskById(data, id, (t) => applyDraftToTask(t, draft, now));
  const cut = task.originalDate;
  const endedOld: TaskSeries = { ...old, endDate: addDays(cut, -1), updatedAt: now };

  // Drop untouched future occurrences of the old series; they get regenerated by the new rule.
  const keep = data.tasks.filter(
    (t) => !(t.seriesId === old.id && t.id !== id && t.originalDate > cut && t.status === 'todo' && t.dueDate === t.originalDate),
  );

  if (!isRecurring(draft.repeat)) {
    const tasks = keep.map((t) =>
      t.id === id ? { ...applyDraftToTask(t, draft, now), seriesId: null, repeat: { frequency: 'none' as const } } : t,
    );
    return { ...data, tasks, series: data.series.map((s) => (s.id === old.id ? endedOld : s)) };
  }

  const newSeries = seriesFromDraft(draft, draft.dueDate, now);
  newSeries.materializedThrough = draft.dueDate;
  const tasks = keep.map((t) => {
    if (t.id === id) {
      return { ...applyDraftToTask(t, draft, now), seriesId: newSeries.id, originalDate: draft.dueDate, repeat: draft.repeat };
    }
    // Occurrences after the cut that the user already touched move to the new series with new details.
    if (t.seriesId === old.id && t.originalDate > cut) {
      return {
        ...t,
        seriesId: newSeries.id,
        title: newSeries.title,
        description: newSeries.description,
        categoryId: newSeries.categoryId,
        reminder: newSeries.reminder,
        priority: newSeries.priority,
        repeat: newSeries.repeat,
        updatedAt: now,
      };
    }
    return t;
  });
  const series = [...data.series.map((s) => (s.id === old.id ? endedOld : s)), newSeries];
  return materialize({ ...data, tasks, series }, today, now);
}

export function deleteTask(data: AppData, id: string, scope: SeriesScope, now: Timestamp): AppData {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return data;
  if (!task.seriesId) {
    return { ...data, tasks: data.tasks.filter((t) => t.id !== id) };
  }
  if (scope === 'this') {
    return {
      ...data,
      tasks: data.tasks.filter((t) => t.id !== id),
      series: data.series.map((s) =>
        s.id === task.seriesId ? { ...s, skippedDates: [...s.skippedDates, task.originalDate], updatedAt: now } : s,
      ),
    };
  }
  // 'future': stop the series and remove this and later occurrences that weren't completed.
  return {
    ...data,
    tasks: data.tasks.filter(
      (t) => !(t.seriesId === task.seriesId && t.originalDate >= task.originalDate && t.status !== 'completed'),
    ),
    series: data.series.map((s) =>
      s.id === task.seriesId ? { ...s, endDate: addDays(task.originalDate, -1), updatedAt: now } : s,
    ),
  };
}

// ---------- Categories ----------

export function addCategory(data: AppData, input: Pick<Category, 'name' | 'emoji' | 'color'>, now: Timestamp): AppData {
  const category: Category = { id: createId('cat_'), ...input, name: input.name.trim(), isDefault: false, createdAt: now };
  return { ...data, categories: [...data.categories, category] };
}

export function updateCategory(data: AppData, id: string, input: Pick<Category, 'name' | 'emoji' | 'color'>): AppData {
  return {
    ...data,
    categories: data.categories.map((c) => (c.id === id ? { ...c, ...input, name: input.name.trim() } : c)),
  };
}

/** Delete a category; its tasks and series move to the fallback category. */
export function deleteCategory(data: AppData, id: string, now: Timestamp): AppData {
  if (id === FALLBACK_CATEGORY_ID) return data;
  const fallback = data.categories.find((c) => c.id === FALLBACK_CATEGORY_ID) ? FALLBACK_CATEGORY_ID : data.categories.find((c) => c.id !== id)?.id;
  if (!fallback) return data;
  return {
    ...data,
    categories: data.categories.filter((c) => c.id !== id),
    tasks: data.tasks.map((t) => (t.categoryId === id ? { ...t, categoryId: fallback, updatedAt: now } : t)),
    series: data.series.map((s) => (s.categoryId === id ? { ...s, categoryId: fallback, updatedAt: now } : s)),
  };
}

export function draftFromTask(t: Task): TaskDraft {
  return {
    title: t.title,
    description: t.description,
    categoryId: t.categoryId,
    dueDate: t.dueDate,
    scheduledTime: t.scheduledTime,
    reminder: t.reminder,
    repeat: t.repeat,
    priority: t.priority,
  };
}
