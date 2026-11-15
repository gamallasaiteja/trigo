import React, { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '@/utils/navigation';
import { Bell, CalendarDays, Clock3, Flag, Repeat, Tag as TagIcon } from 'lucide-react-native';
import type { Priority, RepeatFrequency, TaskDraft } from '@/models/types';
import { useApp } from '@/store/AppStore';
import { radius, useTheme } from '@/theme';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Text } from '@/components/Text';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Button } from '@/components/Button';
import { MiniCalendar } from '@/components/MiniCalendar';
import { TimeStepper } from '@/components/TimeStepper';
import { ChoiceSheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { addDays, formatRelativeDate, formatTime, WEEKDAYS_SHORT, weekday } from '@/logic/dates';
import { draftFromTask } from '@/logic/taskOps';
import { PRIORITY_LABEL } from '@/components/taskMeta';

const TIME_PRESETS = [
  { label: 'Morning', time: '08:00' },
  { label: 'Afternoon', time: '13:00' },
  { label: 'Evening', time: '19:00' },
];
const REMINDER_PRESETS = [
  { label: 'At time', mins: 0 },
  { label: '5 min before', mins: 5 },
  { label: '15 min before', mins: 15 },
  { label: '30 min before', mins: 30 },
];
const REPEAT_OPTIONS: { key: RepeatFrequency; label: string }[] = [
  { key: 'none', label: 'Does not repeat' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekdays', label: 'Weekdays' },
  { key: 'weekends', label: 'Weekends' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'custom', label: 'Custom days' },
];
// Borderless inputs: hide the browser focus box (the caret shows focus).
const noOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : null) as object | null;
const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high'];

export default function TaskForm() {
  const { data, today, actions } = useApp();
  const { colors } = useTheme();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string; date?: string; category?: string }>();
  const editing = params.id ? data.tasks.find((t) => t.id === params.id) : undefined;

  const initial = useMemo<TaskDraft>(() => {
    if (editing) return draftFromTask(editing);
    const date = params.date && params.date >= today ? params.date : today;
    return {
      title: '',
      description: '',
      categoryId: params.category ?? data.categories[0]?.id ?? 'cat_personal',
      dueDate: date,
      scheduledTime: null,
      reminder: null,
      repeat: { frequency: 'none' },
      priority: 'none',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [draft, setDraft] = useState<TaskDraft>(initial);
  const [showCalendar, setShowCalendar] = useState(false);
  const [customTime, setCustomTime] = useState(
    !!initial.scheduledTime && !TIME_PRESETS.some((p) => p.time === initial.scheduledTime),
  );
  const [customReminder, setCustomReminder] = useState(
    !!initial.reminder && !REMINDER_PRESETS.some((p) => p.mins === initial.reminder!.offsetMinutes),
  );
  const [customReminderText, setCustomReminderText] = useState(initial.reminder ? String(initial.reminder.offsetMinutes) : '60');
  const [reminderTouched, setReminderTouched] = useState(!!editing);
  const [error, setError] = useState<string | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const titleRef = useRef<TextInputInstance>(null);

  const set = (patch: Partial<TaskDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const setTime = (time: string | null) => {
    const patch: Partial<TaskDraft> = { scheduledTime: time };
    if (!time) patch.reminder = null;
    else if (!reminderTouched && !draft.reminder && data.settings.defaultReminderMinutes !== null) {
      patch.reminder = { offsetMinutes: data.settings.defaultReminderMinutes };
    }
    set(patch);
  };

  const validate = (): string | null => {
    if (!draft.title.trim()) return 'Give your task a name.';
    if (draft.repeat.frequency === 'custom' && !(draft.repeat.days && draft.repeat.days.length)) return 'Choose at least one day to repeat on.';
    if (customReminder && draft.scheduledTime) {
      const n = Number(customReminderText);
      if (!Number.isInteger(n) || n < 0 || n > 1440) return 'Custom reminder must be between 0 and 1440 minutes.';
    }
    return null;
  };

  const finalDraft = (): TaskDraft => {
    let reminder = draft.scheduledTime ? draft.reminder : null;
    if (customReminder && draft.scheduledTime) reminder = { offsetMinutes: Number(customReminderText) };
    return { ...draft, reminder };
  };

  const save = (scope?: 'this' | 'future') => {
    const err = validate();
    if (err) {
      setError(err);
      if (!draft.title.trim()) titleRef.current?.focus();
      return;
    }
    const d = finalDraft();
    if (editing) {
      if (editing.seriesId && !scope) {
        const ruleChanged = JSON.stringify(editing.repeat) !== JSON.stringify(d.repeat);
        if (ruleChanged) return save('future');
        setScopeOpen(true);
        return;
      }
      actions.updateTask(editing.id, d, scope ?? 'this');
      toast({ message: 'Changes saved' });
    } else {
      actions.createTask(d);
      toast({ message: d.repeat.frequency === 'none' ? `Added “${d.title.trim()}”` : `Added “${d.title.trim()}”, repeats ${REPEAT_OPTIONS.find((r) => r.key === d.repeat.frequency)?.label.toLowerCase()}` });
    }
    goBack();
  };

  if (params.id && !editing) {
    return (
      <Screen header={<Header title="Edit task" leading="close" />}>
        <Text tone="secondary" align="center" style={{ marginTop: 40 }}>
          This task no longer exists.
        </Text>
      </Screen>
    );
  }

  const dateChips = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: 'Next week', date: addDays(today, 7) },
  ];
  const customDate = !dateChips.some((c) => c.date === draft.dueDate);

  return (
    <Screen
      edges={['top', 'bottom']}
      header={
        <Header
          title={editing ? 'Edit task' : 'New task'}
          leading="close"
          right={
            <Pressable onPress={() => save()} hitSlop={10} accessibilityRole="button" testID="header-save">
              <Text variant="bodyStrong" tone="primary">
                Save
              </Text>
            </Pressable>
          }
        />
      }
      footer={
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <Button testID="save-task" title={editing ? 'Save changes' : 'Add task'} onPress={() => save()} />
        </View>
      }
      contentStyle={styles.content}
    >
      {/* Title */}
      <Card style={styles.titleCard}>
        <TextInput
          ref={titleRef}
          testID="task-title"
          value={draft.title}
          onChangeText={(title) => {
            set({ title });
            if (error) setError(null);
          }}
          placeholder="What do you want to do?"
          placeholderTextColor={colors.textMuted}
          autoFocus={!editing}
          returnKeyType="done"
          onSubmitEditing={() => save()}
          maxLength={120}
          style={[styles.titleInput, { color: colors.text }, noOutline]}
          accessibilityLabel="Task title"
        />
        <TextInput
          testID="task-description"
          value={draft.description}
          onChangeText={(description) => set({ description })}
          placeholder="Add a note (optional)"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={1000}
          style={[styles.descInput, { color: colors.textSecondary }, noOutline]}
          accessibilityLabel="Description"
        />
      </Card>
      {error ? (
        <Text variant="smallStrong" tone="danger" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      {/* Category */}
      <Field icon={<TagIcon size={16} color={colors.textSecondary} />} label="Category">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={styles.hRow} keyboardShouldPersistTaps="handled">
          {data.categories.map((c) => (
            <Chip key={c.id} label={`${c.emoji} ${c.name}`} selected={draft.categoryId === c.id} onPress={() => set({ categoryId: c.id })} />
          ))}
          <Chip label="+ New" onPress={() => router.push('/categories?new=1')} />
        </ScrollView>
      </Field>

      {/* Date */}
      <Field icon={<CalendarDays size={16} color={colors.textSecondary} />} label="Date" value={formatRelativeDate(draft.dueDate, today)}>
        <View style={styles.wrap}>
          {dateChips.map((c) => (
            <Chip
              key={c.label}
              label={c.label}
              selected={draft.dueDate === c.date && !showCalendar}
              onPress={() => {
                set({ dueDate: c.date });
                setShowCalendar(false);
              }}
            />
          ))}
          <Chip label={customDate && !showCalendar ? formatRelativeDate(draft.dueDate, today) : 'Pick a date'} selected={showCalendar || customDate} onPress={() => setShowCalendar(!showCalendar)} />
        </View>
        {showCalendar ? (
          <Card style={styles.inset}>
            <MiniCalendar
              value={draft.dueDate}
              today={today}
              weekStart={data.settings.weekStart}
              minDate={editing ? undefined : today}
              onChange={(dueDate) => {
                set({ dueDate });
                setShowCalendar(false);
              }}
            />
          </Card>
        ) : null}
      </Field>

      {/* Time */}
      <Field icon={<Clock3 size={16} color={colors.textSecondary} />} label="Time" value={draft.scheduledTime ? formatTime(draft.scheduledTime) : 'Anytime'}>
        <View style={styles.wrap}>
          <Chip
            label="Anytime"
            selected={!draft.scheduledTime}
            onPress={() => {
              setTime(null);
              setCustomTime(false);
            }}
          />
          {TIME_PRESETS.map((p) => (
            <Chip
              key={p.label}
              label={`${p.label} · ${formatTime(p.time)}`}
              selected={!customTime && draft.scheduledTime === p.time}
              onPress={() => {
                setTime(p.time);
                setCustomTime(false);
              }}
            />
          ))}
          <Chip
            testID="time-custom"
            label="Custom"
            selected={customTime}
            onPress={() => {
              setCustomTime(true);
              if (!draft.scheduledTime) setTime('09:00');
            }}
          />
        </View>
        {customTime && draft.scheduledTime ? (
          <Card style={styles.inset}>
            <TimeStepper value={draft.scheduledTime} onChange={(t) => setTime(t)} />
          </Card>
        ) : null}
      </Field>

      {/* Reminder */}
      <Field icon={<Bell size={16} color={colors.textSecondary} />} label="Reminder">
        {draft.scheduledTime ? (
          <>
            <View style={styles.wrap}>
              <Chip
                label="None"
                selected={!draft.reminder && !customReminder}
                onPress={() => {
                  set({ reminder: null });
                  setCustomReminder(false);
                  setReminderTouched(true);
                }}
              />
              {REMINDER_PRESETS.map((p) => (
                <Chip
                  key={p.label}
                  label={p.label}
                  selected={!customReminder && draft.reminder?.offsetMinutes === p.mins}
                  onPress={() => {
                    set({ reminder: { offsetMinutes: p.mins } });
                    setCustomReminder(false);
                    setReminderTouched(true);
                  }}
                />
              ))}
              <Chip
                label="Custom"
                selected={customReminder}
                onPress={() => {
                  setCustomReminder(true);
                  setReminderTouched(true);
                }}
              />
            </View>
            {customReminder ? (
              <View style={styles.customReminder}>
                <TextInput
                  value={customReminderText}
                  onChangeText={(t) => setCustomReminderText(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={4}
                  style={[styles.minutesInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                  accessibilityLabel="Minutes before"
                />
                <Text tone="secondary">minutes before</Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text variant="small" tone="secondary">
            Choose a time to get a reminder.
          </Text>
        )}
      </Field>

      {/* Repeat */}
      <Field icon={<Repeat size={16} color={colors.textSecondary} />} label="Repeat">
        <View style={styles.wrap}>
          {REPEAT_OPTIONS.map((o) => (
            <Chip
              key={o.key}
              label={o.key === 'weekly' ? `Weekly on ${WEEKDAYS_SHORT[weekday(draft.dueDate)]}` : o.label}
              selected={draft.repeat.frequency === o.key}
              onPress={() =>
                set({
                  repeat: o.key === 'custom' ? { frequency: 'custom', days: draft.repeat.days?.length ? draft.repeat.days : [weekday(draft.dueDate)] } : { frequency: o.key },
                })
              }
            />
          ))}
        </View>
        {draft.repeat.frequency === 'custom' ? (
          <View style={styles.days}>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const on = draft.repeat.days?.includes(d) ?? false;
              return (
                <Pressable
                  key={d}
                  onPress={() => {
                    const days = new Set(draft.repeat.days ?? []);
                    if (on) days.delete(d);
                    else days.add(d);
                    set({ repeat: { frequency: 'custom', days: [...days].sort() } });
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={WEEKDAYS_SHORT[d]}
                  style={[styles.dayBtn, { backgroundColor: on ? colors.primary : colors.card, borderColor: on ? colors.primary : colors.border }]}
                >
                  <Text variant="smallStrong" color={on ? colors.onPrimary : colors.text}>
                    {WEEKDAYS_SHORT[d].slice(0, 2)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {editing?.seriesId ? (
          <Text variant="caption" tone="secondary" style={styles.note}>
            Changing how often it repeats applies to this and future occurrences. Past ones keep their history.
          </Text>
        ) : null}
      </Field>

      {/* Priority */}
      <Field icon={<Flag size={16} color={colors.textSecondary} />} label="Priority">
        <View style={styles.wrap}>
          {PRIORITIES.map((p) => (
            <Chip key={p} label={PRIORITY_LABEL[p]} selected={draft.priority === p} onPress={() => set({ priority: p })} />
          ))}
        </View>
      </Field>

      <ChoiceSheet
        visible={scopeOpen}
        onClose={() => setScopeOpen(false)}
        title="This is a repeating task"
        message="Apply your changes to:"
        options={[
          { label: 'This task only', onPress: () => save('this'), testID: 'scope-this' },
          { label: 'This and all future tasks', onPress: () => save('future'), testID: 'scope-future' },
        ]}
      />
    </Screen>
  );
}

function Field({ icon, label, value, children }: { icon: React.ReactNode; label: string; value?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        {icon}
        <Text variant="smallStrong" tone="secondary" style={styles.fieldLabel}>
          {label}
        </Text>
        {value ? (
          <Text variant="smallStrong" tone="primary">
            {value}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40 },
  titleCard: { paddingVertical: 8 },
  titleInput: { fontSize: 20, fontWeight: '600', paddingVertical: 10 },
  descInput: { fontSize: 15, minHeight: 40, paddingVertical: 6, textAlignVertical: 'top' },
  error: { marginTop: 8, marginLeft: 4 },
  field: { marginTop: 22 },
  fieldHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  fieldLabel: { flex: 1, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hScroll: { marginHorizontal: -20 },
  hRow: { gap: 8, paddingHorizontal: 20 },
  inset: { marginTop: 12 },
  customReminder: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  minutesInput: { width: 80, height: 44, borderWidth: 1, borderRadius: radius.md, textAlign: 'center', fontSize: 16 },
  days: { flexDirection: 'row', gap: 6, marginTop: 12 },
  dayBtn: { flex: 1, height: 42, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  note: { marginTop: 10 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
