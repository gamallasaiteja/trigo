import { countStatuses, isMissed, isOverdue, monthCalendar, performanceSummary, recentDays } from '@/logic/analytics';
import { generateInsights } from '@/logic/insights';
import { createTask, reschedule, toggleComplete } from '@/logic/taskOps';
import { addDays } from '@/logic/dates';
import { planNotifications } from '@/services/notificationPlan';
import { buildSampleData } from '@/logic/sampleData';
import type { AppData } from '@/models/types';
import { draft, empty, NOW, TODAY } from './helpers';

function withDaily(days = 10): AppData {
  // Series started `days` ago; complete every other day.
  let d = createTask(empty(), draft({ title: 'Walk', categoryId: 'cat_health', dueDate: addDays(TODAY, -days), repeat: { frequency: 'daily' } }), TODAY, NOW);
  d.tasks
    .filter((t) => t.dueDate <= TODAY)
    .forEach((t, i) => {
      if (i % 2 === 0) d = toggleComplete(d, t.id, NOW);
    });
  return d;
}

describe('analytics', () => {
  it('counts only real data and ignores future tasks in rates', () => {
    const d = withDaily(9); // 10 days due (-9..0), 5 completed
    const s = performanceSummary(d.tasks, d.categories, TODAY, 1);
    expect(s.dueSoFar).toBe(10);
    expect(s.totalCompleted).toBe(5);
    expect(s.overallRate).toBeCloseTo(0.5);
  });

  it('returns null rates and no insights for an empty app', () => {
    const d = empty();
    const s = performanceSummary(d.tasks, d.categories, TODAY, 1);
    expect(s.overallRate).toBeNull();
    expect(s.mostConsistent).toBeNull();
    expect(generateInsights(d.tasks, d.categories, TODAY, 1)).toEqual([]);
  });

  it('marks calendar days by state', () => {
    const d = withDaily(3);
    const weeks = monthCalendar(d.tasks, TODAY, 1, TODAY);
    const days = new Map(weeks.flat().map((x) => [x.date, x]));
    expect(days.get(addDays(TODAY, -3))!.state).toBe('done');
    expect(days.get(addDays(TODAY, -2))!.state).toBe('missed');
    expect(days.get(addDays(TODAY, 2))!.state).toBe('planned');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('distinguishes overdue one-offs from missed recurring occurrences', () => {
    let d = createTask(empty(), draft({ dueDate: addDays(TODAY, -2), repeat: { frequency: 'none' } }), TODAY, NOW);
    d = createTask(d, draft({ dueDate: addDays(TODAY, -2), repeat: { frequency: 'daily' } }), TODAY, NOW);
    const single = d.tasks.find((t) => !t.seriesId)!;
    const occ = d.tasks.find((t) => t.seriesId && t.dueDate === addDays(TODAY, -2))!;
    expect(isOverdue(single, TODAY)).toBe(true);
    expect(isMissed(single, TODAY)).toBe(false);
    expect(isOverdue(occ, TODAY)).toBe(false);
    expect(isMissed(occ, TODAY)).toBe(true);
  });

  it('recentDays returns 7 days ending today', () => {
    const r = recentDays(withDaily(9).tasks, TODAY);
    expect(r).toHaveLength(7);
    expect(r[6].date).toBe(TODAY);
  });
});

describe('insights', () => {
  it('only reports postponing when reschedules were recorded', () => {
    let d = withDaily(9);
    expect(generateInsights(d.tasks, d.categories, TODAY, 1).some((i) => i.id === 'postponed')).toBe(false);
    d = createTask(d, draft({ title: 'Course', dueDate: TODAY }), TODAY, NOW);
    const c = d.tasks.find((t) => t.title === 'Course')!;
    d = reschedule(d, c.id, addDays(TODAY, 1), undefined, NOW);
    d = reschedule(d, c.id, addDays(TODAY, 2), undefined, NOW);
    const ins = generateInsights(d.tasks, d.categories, TODAY, 1);
    expect(ins.find((i) => i.id === 'postponed')?.text).toContain('Learning');
  });

  it('weekly rate insight matches the numbers', () => {
    const d = withDaily(9);
    const week = d.tasks.filter((t) => t.dueDate >= '2026-11-09' && t.dueDate < TODAY);
    const c = countStatuses(week);
    const ins = generateInsights(d.tasks, d.categories, TODAY, 1).find((i) => i.id === 'week-rate')!;
    expect(ins.text).toContain(`(${c.completed} of ${c.total})`);
  });

  it("does not count today's unfinished tasks against comparative insights", () => {
    let d = withDaily(9);
    const before = generateInsights(d.tasks, d.categories, TODAY, 1).map((i) => i.text);
    for (let i = 0; i < 5; i++) d = createTask(d, draft({ title: `Later ${i}`, scheduledTime: '23:00' }), TODAY, NOW);
    const after = generateInsights(d.tasks, d.categories, TODAY, 1).map((i) => i.text);
    expect(after).toEqual(before);
  });

  it('sample data produces consistent analytics', () => {
    const d = buildSampleData(empty(), TODAY, new Date(2026, 10, 15, 12, 0));
    expect(d.tasks.length).toBeGreaterThan(100);
    const s = performanceSummary(d.tasks, d.categories, TODAY, 1);
    expect(s.overallRate).toBeGreaterThan(0.4);
    expect(s.overallRate).toBeLessThan(1);
  });
});

describe('notification plan', () => {
  it('schedules reminders for future, unfinished tasks and a morning summary', () => {
    let d = createTask(empty(), draft({ scheduledTime: '21:00', reminder: { offsetMinutes: 15 } }), TODAY, NOW);
    d = createTask(d, draft({ title: 'Done already', scheduledTime: '22:00' }), TODAY, NOW);
    d = toggleComplete(d, d.tasks[1].id, NOW);
    const plan = planNotifications(d, new Date(2026, 10, 15, 7, 0));
    const tasks = plan.filter((p) => p.data.kind === 'task');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].date.getHours()).toBe(20);
    expect(tasks[0].date.getMinutes()).toBe(45);
    const summary = plan.find((p) => p.data.kind === 'summary')!;
    expect(summary.body).toContain('1 important thing');
  });

  it('respects the master switch and the 64-notification iOS limit', () => {
    let d = createTask(empty(), draft({ repeat: { frequency: 'daily' } }), TODAY, NOW);
    for (let i = 0; i < 12; i++) d = createTask(d, draft({ title: `T${i}`, repeat: { frequency: 'daily' } }), TODAY, NOW);
    expect(planNotifications(d, new Date(2026, 10, 15, 7, 0)).length).toBeLessThanOrEqual(60);
    expect(planNotifications({ ...d, settings: { ...d.settings, notificationsEnabled: false } })).toEqual([]);
  });
});
