import { materializeAll, nextOccurrence, occursOn } from '@/logic/recurrence';
import { createTask, deleteTask, materialize, reschedule, setStatus, toggleComplete, updateTask } from '@/logic/taskOps';
import { addDays } from '@/logic/dates';
import { draft, empty, NOW, TODAY } from './helpers';

describe('occursOn', () => {
  it('handles each frequency', () => {
    // 2026-11-16 is Monday, 2026-11-21 Saturday
    expect(occursOn({ frequency: 'daily' }, '2026-11-15', '2026-11-20')).toBe(true);
    expect(occursOn({ frequency: 'weekdays' }, '2026-11-15', '2026-11-16')).toBe(true);
    expect(occursOn({ frequency: 'weekdays' }, '2026-11-15', '2026-11-21')).toBe(false);
    expect(occursOn({ frequency: 'weekends' }, '2026-11-15', '2026-11-21')).toBe(true);
    expect(occursOn({ frequency: 'weekly' }, '2026-11-15', '2026-11-22')).toBe(true);
    expect(occursOn({ frequency: 'weekly' }, '2026-11-15', '2026-11-21')).toBe(false);
    expect(occursOn({ frequency: 'custom', days: [1, 3] }, '2026-11-15', '2026-11-18')).toBe(true);
    expect(occursOn({ frequency: 'custom', days: [1, 3] }, '2026-11-15', '2026-11-19')).toBe(false);
    expect(occursOn({ frequency: 'daily' }, '2026-11-15', '2026-11-14')).toBe(false);
  });
  it('finds the next occurrence', () => {
    expect(nextOccurrence({ frequency: 'weekdays' }, TODAY, TODAY)).toBe('2026-11-16');
  });
});

describe('recurring tasks', () => {
  it('creates separate dated occurrences up to the horizon, without duplicates', () => {
    let d = createTask(empty(), draft({ repeat: { frequency: 'daily' } }), TODAY, NOW);
    expect(d.series).toHaveLength(1);
    expect(d.tasks).toHaveLength(15); // today + 14 days ahead
    expect(new Set(d.tasks.map((t) => t.dueDate)).size).toBe(15);
    d = materialize(d, TODAY, NOW);
    expect(d.tasks).toHaveLength(15);
    // Next day: exactly one more occurrence appears.
    d = materialize(d, addDays(TODAY, 1), NOW);
    expect(d.tasks).toHaveLength(16);
  });

  it('back-fills missed days so they are recorded, not silently dropped', () => {
    const d = createTask(empty(), draft({ repeat: { frequency: 'daily' } }), TODAY, NOW);
    const later = materialize(d, addDays(TODAY, 20), NOW);
    const dates = later.tasks.map((t) => t.dueDate).sort();
    expect(dates[0]).toBe(TODAY);
    expect(later.tasks.filter((t) => t.dueDate < addDays(TODAY, 20)).every((t) => t.status === 'todo')).toBe(true);
  });

  it('keeps completion history per occurrence', () => {
    let d = createTask(empty(), draft({ repeat: { frequency: 'daily' } }), TODAY, NOW);
    const first = d.tasks.find((t) => t.dueDate === TODAY)!;
    d = toggleComplete(d, first.id, NOW);
    const done = d.tasks.find((t) => t.id === first.id)!;
    expect(done.status).toBe('completed');
    expect(done.completedAt).toBe(NOW);
    expect(d.tasks.filter((t) => t.status === 'completed')).toHaveLength(1);
  });

  it('delete "this" skips the date permanently', () => {
    let d = createTask(empty(), draft({ repeat: { frequency: 'daily' } }), TODAY, NOW);
    const t = d.tasks.find((x) => x.dueDate === addDays(TODAY, 2))!;
    d = deleteTask(d, t.id, 'this', NOW);
    d = materialize({ ...d, series: d.series.map((s) => ({ ...s, materializedThrough: null })) }, TODAY, NOW);
    expect(d.tasks.some((x) => x.dueDate === addDays(TODAY, 2))).toBe(false);
  });

  it('delete "future" ends the series but keeps completed history', () => {
    let d = createTask(empty(), draft({ repeat: { frequency: 'daily' } }), TODAY, NOW);
    const first = d.tasks.find((x) => x.dueDate === TODAY)!;
    d = toggleComplete(d, first.id, NOW);
    const third = d.tasks.find((x) => x.dueDate === addDays(TODAY, 2))!;
    d = deleteTask(d, third.id, 'future', NOW);
    expect(d.tasks.map((t) => t.dueDate).sort()).toEqual([TODAY, addDays(TODAY, 1)]);
    d = materialize(d, addDays(TODAY, 10), NOW);
    expect(d.tasks).toHaveLength(2);
  });

  it('edit "future" splits the series and leaves the past untouched', () => {
    let d = createTask(empty(), draft({ repeat: { frequency: 'daily' } }), TODAY, NOW);
    const first = d.tasks.find((x) => x.dueDate === TODAY)!;
    d = toggleComplete(d, first.id, NOW);
    const target = d.tasks.find((x) => x.dueDate === addDays(TODAY, 3))!;
    d = updateTask(d, target.id, { ...draft({ repeat: { frequency: 'daily' } }), title: 'Read 30 pages', dueDate: target.dueDate }, 'future', TODAY, NOW);
    expect(d.series).toHaveLength(2);
    expect(d.tasks.find((t) => t.id === first.id)!.title).toBe('Read 20 pages');
    const future = d.tasks.filter((t) => t.dueDate >= target.dueDate);
    expect(future.every((t) => t.title === 'Read 30 pages')).toBe(true);
    // No duplicate dates.
    const dates = d.tasks.map((t) => t.dueDate);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('edit "this" changes only one occurrence', () => {
    let d = createTask(empty(), draft({ repeat: { frequency: 'daily' } }), TODAY, NOW);
    const t = d.tasks[1];
    d = updateTask(d, t.id, { ...draft({ repeat: { frequency: 'daily' } }), title: 'Special', dueDate: t.dueDate }, 'this', TODAY, NOW);
    expect(d.tasks.filter((x) => x.title === 'Special')).toHaveLength(1);
  });
});

describe('single tasks', () => {
  it('reschedule keeps history and does not create duplicates for recurring tasks', () => {
    let d = createTask(empty(), draft({ repeat: { frequency: 'daily' } }), TODAY, NOW);
    const t = d.tasks.find((x) => x.dueDate === TODAY)!;
    d = reschedule(d, t.id, addDays(TODAY, 1), undefined, NOW);
    const moved = d.tasks.find((x) => x.id === t.id)!;
    expect(moved.dueDate).toBe(addDays(TODAY, 1));
    expect(moved.originalDate).toBe(TODAY);
    expect(moved.history.at(-1)).toMatchObject({ type: 'rescheduled', from: `${TODAY} 21:00`, to: `${addDays(TODAY, 1)} 21:00` });
    const again = materializeAll(d.series.map((s) => ({ ...s, materializedThrough: null })), d.tasks, TODAY, NOW);
    expect(again.tasks.length).toBe(d.tasks.length);
  });

  it('status changes record timestamps and history', () => {
    let d = createTask(empty(), draft(), TODAY, NOW);
    const id = d.tasks[0].id;
    d = setStatus(d, id, 'in_progress', NOW);
    expect(d.tasks[0].startedAt).toBe(NOW);
    d = setStatus(d, id, 'completed', NOW);
    expect(d.tasks[0].completedAt).toBe(NOW);
    d = toggleComplete(d, id, NOW);
    expect(d.tasks[0].status).toBe('todo');
    expect(d.tasks[0].completedAt).toBeNull();
    expect(d.tasks[0].history.filter((e) => e.type === 'status_changed')).toHaveLength(3);
  });

  it('turning a single task into a repeating one does not duplicate it', () => {
    let d = createTask(empty(), draft(), TODAY, NOW);
    d = updateTask(d, d.tasks[0].id, draft({ repeat: { frequency: 'daily' } }), 'this', TODAY, NOW);
    expect(d.tasks.filter((t) => t.dueDate === TODAY)).toHaveLength(1);
    expect(d.tasks).toHaveLength(15);
  });
});
