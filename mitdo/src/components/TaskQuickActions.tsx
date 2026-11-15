import React from 'react';
import { router } from 'expo-router';
import { CalendarClock, CheckCircle2, Circle, Clock3, Pencil } from 'lucide-react-native';
import type { Task } from '@/models/types';
import { addDays } from '@/logic/dates';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme';
import { ChoiceSheet, type SheetOption } from './Sheet';

/** Long-press menu for a task: change status, push to tomorrow, edit. */
export function TaskQuickActions({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { actions, today } = useApp();
  const { colors } = useTheme();
  if (!task) return <ChoiceSheet visible={false} onClose={onClose} options={[]} />;
  const opts: SheetOption[] = [];
  if (task.status !== 'completed')
    opts.push({ label: 'Mark as done', icon: <CheckCircle2 size={20} color={colors.success} />, onPress: () => actions.setStatus(task.id, 'completed') });
  if (task.status !== 'in_progress')
    opts.push({ label: 'Mark as in progress', icon: <Clock3 size={20} color={colors.warning} />, onPress: () => actions.setStatus(task.id, 'in_progress') });
  if (task.status !== 'todo')
    opts.push({ label: 'Mark as to do', icon: <Circle size={20} color={colors.todo} />, onPress: () => actions.setStatus(task.id, 'todo') });
  if (task.status !== 'completed') {
    const target = task.dueDate < today ? today : addDays(task.dueDate, 1);
    opts.push({
      label: task.dueDate < today ? 'Move to today' : 'Move to tomorrow',
      icon: <CalendarClock size={20} color={colors.primary} />,
      onPress: () => actions.reschedule(task.id, target),
    });
  }
  opts.push({ label: 'Edit task', icon: <Pencil size={20} color={colors.text} />, onPress: () => router.push(`/task/new?id=${task.id}`) });
  return <ChoiceSheet visible onClose={onClose} title={task.title} options={opts} />;
}
