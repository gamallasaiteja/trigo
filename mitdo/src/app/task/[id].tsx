import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '@/utils/navigation';
import { AlarmClock, Bell, CalendarClock, CalendarDays, Clock3, Pencil, Repeat, Trash2 } from 'lucide-react-native';
import type { DateKey, TaskEvent, TaskStatus } from '@/models/types';
import { useApp } from '@/store/AppStore';
import { radius, useTheme } from '@/theme';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Text } from '@/components/Text';
import { Card } from '@/components/Card';
import { Tag } from '@/components/Chip';
import { Button } from '@/components/Button';
import { ChoiceSheet, Sheet } from '@/components/Sheet';
import { MiniCalendar } from '@/components/MiniCalendar';
import { EmptyState } from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { PRIORITY_LABEL, priorityColors } from '@/components/taskMeta';
import { isMissed, isOverdue } from '@/logic/analytics';
import { addDays, formatDateTime, formatRelativeDate, formatTime, WEEKDAYS_SHORT, weekday } from '@/logic/dates';
import { notificationsSupported } from '@/services/notifications';

const STATUS_OPTIONS: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Done' },
];

const STATUS_LABEL: Record<string, string> = { todo: 'To Do', in_progress: 'In Progress', completed: 'Done' };

function repeatLabel(freq: string, days: number[] | undefined, date: DateKey): string {
  switch (freq) {
    case 'daily':
      return 'Every day';
    case 'weekdays':
      return 'Weekdays (Mon–Fri)';
    case 'weekends':
      return 'Weekends';
    case 'weekly':
      return `Every ${WEEKDAYS_SHORT[weekday(date)]}`;
    case 'custom':
      return (days ?? []).map((d) => WEEKDAYS_SHORT[d]).join(', ');
    default:
      return 'Does not repeat';
  }
}

function describeEvent(e: TaskEvent, today: DateKey): string {
  const slot = (s?: string) => {
    if (!s) return '';
    const [d, t] = s.split(' ');
    return `${formatRelativeDate(d, today)}${t ? ` ${formatTime(t)}` : ''}`;
  };
  switch (e.type) {
    case 'created':
      return 'Created';
    case 'edited':
      return 'Edited';
    case 'status_changed':
      return `Marked as ${STATUS_LABEL[e.to ?? ''] ?? e.to}`;
    case 'rescheduled':
      return `Rescheduled from ${slot(e.from)} to ${slot(e.to)}`;
    case 'snoozed':
      return `Reminder snoozed until ${e.to ? formatDateTime(e.to, today).split(', ').pop() : ''}`;
  }
}

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, today, actions } = useApp();
  const theme = useTheme();
  const { colors } = theme;
  const toast = useToast();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [pickDate, setPickDate] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const task = data.tasks.find((t) => t.id === id);
  if (!task) {
    return (
      <Screen header={<Header title="Task" />}>
        <EmptyState emoji="🗂️" title="Task not found" message="It may have been deleted." actionLabel="Go home" onAction={() => router.replace('/')} />
      </Screen>
    );
  }

  const category = data.categories.find((c) => c.id === task.categoryId);
  const cat = category ? theme.category(category.color) : null;
  const pr = priorityColors(task.priority, theme);
  const overdue = isOverdue(task, today);
  const missed = isMissed(task, today);
  const snoozed = task.snoozedUntil && new Date(task.snoozedUntil) > new Date() ? new Date(task.snoozedUntil) : null;

  const doReschedule = (date: DateKey) => {
    actions.reschedule(task.id, date);
    setRescheduleOpen(false);
    setPickDate(false);
    toast({ message: `Moved to ${formatRelativeDate(date, today).toLowerCase()}` });
  };

  const doDelete = (scope: 'this' | 'future') => {
    actions.deleteTask(task.id, scope);
    toast({ message: scope === 'future' ? 'Deleted this and future occurrences' : 'Task deleted' });
    goBack();
  };

  return (
    <Screen
      header={
        <Header
          title="Task details"
          right={
            <Pressable
              testID="edit-task"
              onPress={() => router.push(`/task/new?id=${task.id}`)}
              hitSlop={10}
              accessibilityLabel="Edit task"
              style={[styles.iconBtn, { backgroundColor: colors.card }]}
            >
              <Pencil size={18} color={colors.text} />
            </Pressable>
          }
        />
      }
    >
      <View style={styles.tags}>
        {category && cat ? <Tag label={`${category.emoji} ${category.name}`} fg={cat.fg} bg={cat.bg} /> : null}
        {pr ? <Tag label={PRIORITY_LABEL[task.priority]} fg={pr.fg} bg={pr.bg} /> : null}
        {overdue ? <Tag label="Overdue" fg={colors.danger} bg={colors.dangerSoft} /> : null}
        {missed ? <Tag label="Missed" fg={colors.textSecondary} bg={colors.cardAlt} /> : null}
      </View>
      <Text variant="title" style={styles.title} testID="detail-title">
        {task.title}
      </Text>
      {task.description ? (
        <Text tone="secondary" style={styles.desc}>
          {task.description}
        </Text>
      ) : null}

      {/* Status */}
      <View style={[styles.segment, { backgroundColor: colors.cardAlt }]}>
        {STATUS_OPTIONS.map((o) => {
          const active = task.status === o.key;
          const fg = o.key === 'completed' ? colors.success : o.key === 'in_progress' ? colors.warning : colors.todo;
          return (
            <Pressable
              key={o.key}
              testID={`status-${o.key}`}
              onPress={() => actions.setStatus(task.id, o.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.segBtn, active && { backgroundColor: colors.card, shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }]}
            >
              <Text variant="smallStrong" color={active ? fg : colors.textSecondary}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={styles.info}>
        <InfoRow icon={<CalendarDays size={18} color={colors.primary} />} label="Date" value={formatRelativeDate(task.dueDate, today)} />
        <InfoRow icon={<Clock3 size={18} color={colors.primary} />} label="Time" value={task.scheduledTime ? formatTime(task.scheduledTime) : 'Anytime'} />
        <InfoRow
          icon={<Bell size={18} color={colors.primary} />}
          label="Reminder"
          value={
            snoozed
              ? `Snoozed until ${formatTime(`${String(snoozed.getHours()).padStart(2, '0')}:${String(snoozed.getMinutes()).padStart(2, '0')}`)}`
              : task.reminder && task.scheduledTime
                ? task.reminder.offsetMinutes === 0
                  ? 'At scheduled time'
                  : `${task.reminder.offsetMinutes} min before`
                : 'Off'
          }
        />
        <InfoRow icon={<Repeat size={18} color={colors.primary} />} label="Repeat" value={repeatLabel(task.repeat.frequency, task.repeat.days, task.originalDate)} last />
      </Card>

      {task.status !== 'completed' ? (
        <View style={styles.actions}>
          <Button
            testID="reschedule"
            title="Reschedule"
            kind="secondary"
            icon={<CalendarClock size={18} color={colors.primaryDark} />}
            onPress={() => setRescheduleOpen(true)}
            style={styles.flex}
          />
          {notificationsSupported && task.reminder && task.scheduledTime && task.dueDate === today ? (
            <Button
              title={`Snooze ${data.settings.snoozeMinutes}m`}
              kind="secondary"
              icon={<AlarmClock size={18} color={colors.primaryDark} />}
              onPress={() => {
                actions.snooze(task.id);
                toast({ message: `I’ll remind you again in ${data.settings.snoozeMinutes} minutes` });
              }}
              style={styles.flex}
            />
          ) : null}
        </View>
      ) : (
        <Text variant="small" tone="secondary" align="center" style={styles.doneNote}>
          ✅ Completed {task.completedAt ? formatDateTime(task.completedAt, today).toLowerCase() : ''}
        </Text>
      )}

      {/* History */}
      <Text variant="heading" style={styles.historyTitle}>
        History
      </Text>
      <Card>
        {[...task.history].reverse().map((e, i, arr) => (
          <View key={`${e.at}-${i}`} style={styles.event}>
            <View style={styles.timeline}>
              <View style={[styles.evDot, { backgroundColor: e.type === 'status_changed' && e.to === 'completed' ? colors.success : e.type === 'rescheduled' ? colors.warning : colors.primary }]} />
              {i < arr.length - 1 ? <View style={[styles.evLine, { backgroundColor: colors.border }]} /> : null}
            </View>
            <View style={styles.evBody}>
              <Text variant="smallStrong">{describeEvent(e, today)}</Text>
              <Text variant="caption" tone="secondary">
                {formatDateTime(e.at, today)}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      <Button
        testID="delete-task"
        title="Delete task"
        kind="danger"
        icon={<Trash2 size={18} color={colors.danger} />}
        onPress={() => setDeleteOpen(true)}
        style={styles.delete}
      />

      <Sheet visible={rescheduleOpen} onClose={() => { setRescheduleOpen(false); setPickDate(false); }} title="Reschedule to…">
        {pickDate ? (
          <MiniCalendar value={task.dueDate < today ? today : task.dueDate} today={today} weekStart={data.settings.weekStart} minDate={today} onChange={doReschedule} />
        ) : (
          <>
            {[
              { label: 'Today', date: today },
              { label: 'Tomorrow', date: addDays(today, 1) },
              { label: 'In 2 days', date: addDays(today, 2) },
              { label: 'Next week', date: addDays(today, 7) },
            ]
              .filter((o) => o.date !== task.dueDate)
              .map((o) => (
                <Pressable key={o.label} testID={`resched-${o.label}`} onPress={() => doReschedule(o.date)} style={[styles.sheetRow, { backgroundColor: colors.background }]}>
                  <Text variant="bodyStrong" style={styles.flex}>
                    {o.label}
                  </Text>
                  <Text variant="small" tone="secondary">
                    {formatRelativeDate(o.date, today) === o.label ? '' : formatRelativeDate(o.date, today)}
                  </Text>
                </Pressable>
              ))}
            <Pressable onPress={() => setPickDate(true)} style={[styles.sheetRow, { backgroundColor: colors.background }]}>
              <Text variant="bodyStrong" tone="primary">
                Pick a date…
              </Text>
            </Pressable>
          </>
        )}
      </Sheet>

      <ChoiceSheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={task.seriesId ? 'Delete repeating task' : 'Delete this task?'}
        message={task.seriesId ? 'Completed occurrences stay in your history.' : 'This can’t be undone.'}
        options={
          task.seriesId
            ? [
                { label: 'Delete this occurrence', destructive: true, onPress: () => doDelete('this'), testID: 'delete-this' },
                { label: 'Delete this and future', destructive: true, onPress: () => doDelete('future'), testID: 'delete-future' },
              ]
            : [{ label: 'Delete task', destructive: true, onPress: () => doDelete('this'), testID: 'delete-confirm' }]
        }
      />
    </Screen>
  );
}

function InfoRow({ icon, label, value, last }: { icon: React.ReactNode; label: string; value: string; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.infoRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <View style={[styles.infoIcon, { backgroundColor: colors.primarySoft }]}>{icon}</View>
      <Text variant="body" tone="secondary" style={styles.flex}>
        {label}
      </Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  title: { marginTop: 10 },
  desc: { marginTop: 8, lineHeight: 22 },
  segment: { flexDirection: 'row', borderRadius: radius.lg, padding: 4, marginTop: 20 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md },
  info: { marginTop: 16, paddingVertical: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  infoIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  doneNote: { marginTop: 16 },
  historyTitle: { marginTop: 28, marginBottom: 12 },
  event: { flexDirection: 'row', gap: 12 },
  timeline: { alignItems: 'center', width: 12 },
  evDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  evLine: { width: 2, flex: 1, marginVertical: 2 },
  evBody: { flex: 1, paddingBottom: 14, gap: 2 },
  delete: { marginTop: 28 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: radius.lg, paddingHorizontal: 16 },
});
