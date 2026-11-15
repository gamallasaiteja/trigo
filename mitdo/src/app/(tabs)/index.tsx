import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AlertCircle, Bell, CheckCircle2, Clock3, Circle, Plus } from 'lucide-react-native';
import { useApp } from '@/store/AppStore';
import { radius, useTheme } from '@/theme';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { SectionHeader } from '@/components/SectionHeader';
import { TaskRow } from '@/components/TaskRow';
import { CategoryCard } from '@/components/CategoryCard';
import { EmptyState } from '@/components/EmptyState';
import { Sheet } from '@/components/Sheet';
import { MountainIllustration } from '@/components/Illustrations';
import { compareTasks, countStatuses, overdueTasks, pct, rate, tasksOn } from '@/logic/analytics';
import { formatLongDate, formatTime, greeting, diffDays } from '@/logic/dates';
import { reminderDate } from '@/services/notificationPlan';
import { useToggleTask } from '@/hooks/useTaskActions';

const QUOTES = [
  'Focus on progress, not perfection.',
  'Small steps every day add up.',
  'Do what matters. Keep moving.',
  'Done is better than perfect.',
  'One task at a time.',
  'Consistency beats intensity.',
  'Show up for the things that matter.',
];

const TODAY_LIMIT = 6;

export default function Home() {
  const { data, today } = useApp();
  const theme = useTheme();
  const { colors } = theme;
  const toggle = useToggleTask();
  const [bellOpen, setBellOpen] = useState(false);

  const catById = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  const todays = useMemo(() => tasksOn(data.tasks, today).sort(compareTasks), [data.tasks, today]);
  const overdue = useMemo(() => overdueTasks(data.tasks, today), [data.tasks, today]);
  const counts = countStatuses(todays);
  const r = rate(counts);
  const name = data.settings.userName;

  const subtitle =
    counts.total === 0
      ? 'A fresh page. What matters to you today?'
      : counts.completed === counts.total
        ? 'Everything planned for today is done. Well done! 🎉'
        : counts.completed === 0
          ? `You have ${counts.total} ${counts.total === 1 ? 'thing' : 'things'} planned today. Let’s begin.`
          : `${counts.total - counts.completed} to go. You’re making progress!`;

  const quote = QUOTES[Math.abs(diffDays('2024-01-01', today)) % QUOTES.length];

  const upcomingReminders = useMemo(() => {
    const now = new Date();
    return todays
      .filter((t) => t.status !== 'completed')
      .map((t) => ({ t, at: t.snoozedUntil && new Date(t.snoozedUntil) > now ? new Date(t.snoozedUntil) : reminderDate(t) }))
      .filter((x): x is { t: typeof x.t; at: Date } => !!x.at && x.at > now)
      .sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [todays]);

  const openTask = (id: string) => router.push(`/task/${id}`);

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="small" tone="secondary" style={styles.date}>
            {formatLongDate(today)}
          </Text>
          <Text variant="title" testID="home-greeting">
            {greeting()}{name ? `, ${name}` : ''}! 👋
          </Text>
          <Text variant="small" tone="secondary" style={styles.subtitle}>
            {subtitle}
          </Text>
        </View>
        <Pressable
          onPress={() => setBellOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Reminders, ${upcomingReminders.length} upcoming today`}
          style={[styles.bell, { backgroundColor: colors.card }]}
        >
          <Bell size={20} color={colors.text} />
          {upcomingReminders.length > 0 ? <View style={[styles.dot, { backgroundColor: colors.danger, borderColor: colors.card }]} /> : null}
        </Pressable>
      </View>

      {/* Hero + daily progress */}
      <Card padded={false} style={styles.hero}>
        <View style={[styles.heroTop, { backgroundColor: colors.primarySoft }]}>
          <Text variant="subheading" style={styles.quote}>
            {quote} ✨
          </Text>
          <MountainIllustration width={130} height={96} />
        </View>
        <View style={styles.heroBody}>
          <Text variant="smallStrong">Today’s progress</Text>
          <View style={styles.progressRow}>
            <ProgressBar value={r ?? 0} style={styles.flex} height={10} />
            <Text variant="title" tone="primary" testID="home-progress-pct">
              {pct(r)}%
            </Text>
          </View>
          <View style={[styles.stats, { borderColor: colors.border }]}>
            <Stat icon={<CheckCircle2 size={18} color={colors.success} />} value={counts.completed} label="Completed" />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Stat icon={<Clock3 size={18} color={colors.warning} />} value={counts.inProgress} label="In Progress" />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Stat icon={<Circle size={18} color={colors.todo} />} value={counts.todo} label="To Do" />
          </View>
        </View>
      </Card>

      {/* Overdue */}
      {overdue.length > 0 ? (
        <Card style={[styles.overdue, { backgroundColor: colors.dangerSoft }]} onPress={() => router.push('/tasks?scope=overdue')} accessibilityLabel={`${overdue.length} overdue tasks`}>
          <AlertCircle size={20} color={colors.danger} />
          <View style={styles.flex}>
            <Text variant="bodyStrong" color={colors.danger}>
              {overdue.length} overdue {overdue.length === 1 ? 'task' : 'tasks'}
            </Text>
            <Text variant="small" tone="secondary">
              Complete or reschedule to stay on track
            </Text>
          </View>
          <Text variant="smallStrong" color={colors.danger}>
            Review
          </Text>
        </Card>
      ) : null}

      {/* Categories */}
      <SectionHeader title="Categories" action="See All" onAction={() => router.push('/categories')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cats} style={styles.catsScroll}>
        {data.categories.map((c) => (
          <CategoryCard
            key={c.id}
            category={c}
            caption="today"
            counts={countStatuses(todays.filter((t) => t.categoryId === c.id))}
            onPress={() => router.push(`/tasks?category=${c.id}`)}
          />
        ))}
        <Card onPress={() => router.push('/categories?new=1')} style={[styles.newCat, { borderColor: colors.border }]} accessibilityLabel="New category">
          <Plus size={22} color={colors.primary} />
          <Text variant="smallStrong" tone="primary">
            New
          </Text>
        </Card>
      </ScrollView>

      {/* Today's tasks */}
      <SectionHeader title="Today’s Tasks" action={todays.length ? 'See All' : undefined} onAction={() => router.push('/tasks')} />
      <Card padded={false} style={styles.list}>
        {todays.length === 0 ? (
          <EmptyState
            emoji="🌤️"
            title="Nothing planned for today"
            message="Add the few things that matter most. It takes seconds."
            actionLabel="Add a task"
            onAction={() => router.push('/task/new')}
          />
        ) : (
          todays.slice(0, TODAY_LIMIT).map((t, i) => (
            <View key={t.id} style={[styles.rowWrap, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <TaskRow
                task={t}
                category={catById.get(t.categoryId)}
                today={today}
                variant="compact"
                onToggle={() => toggle(t.id)}
                onPress={() => openTask(t.id)}
              />
            </View>
          ))
        )}
        {todays.length > TODAY_LIMIT ? (
          <Pressable onPress={() => router.push('/tasks')} style={[styles.more, { borderTopColor: colors.border }]}>
            <Text variant="smallStrong" tone="primary">
              View {todays.length - TODAY_LIMIT} more
            </Text>
          </Pressable>
        ) : null}
      </Card>

      <Sheet visible={bellOpen} onClose={() => setBellOpen(false)} title="Today’s reminders">
        {upcomingReminders.length === 0 ? (
          <EmptyState compact emoji="🔕" title="No more reminders today" message="Add a time and reminder to a task and Mitdo will nudge you." />
        ) : (
          upcomingReminders.map(({ t, at }) => (
            <Pressable
              key={t.id}
              onPress={() => {
                setBellOpen(false);
                openTask(t.id);
              }}
              style={[styles.remRow, { backgroundColor: colors.background }]}
            >
              <Bell size={16} color={colors.primary} />
              <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                {t.title}
              </Text>
              <Text variant="small" tone="secondary">
                {formatTime(`${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`)}
              </Text>
            </Pressable>
          ))
        )}
        <Pressable
          onPress={() => {
            setBellOpen(false);
            router.push('/profile');
          }}
          style={styles.remSettings}
        >
          <Text variant="smallStrong" tone="primary" align="center">
            Notification settings
          </Text>
        </Pressable>
      </Sheet>
    </Screen>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <View style={styles.stat}>
      {icon}
      <View>
        <Text variant="title" style={styles.statValue}>
          {value}
        </Text>
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 12, paddingBottom: 18, gap: 12 },
  date: { marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600', fontSize: 11 },
  subtitle: { marginTop: 4 },
  bell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 11, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  hero: { overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 18, paddingRight: 8, paddingTop: 10 },
  quote: { flex: 1, lineHeight: 22, paddingRight: 8 },
  heroBody: { padding: 16, gap: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stats: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, paddingVertical: 12, marginTop: 4 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  statValue: { lineHeight: 26 },
  divider: { width: 1, height: 30 },
  overdue: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  catsScroll: { marginHorizontal: -20 },
  cats: { gap: 12, paddingHorizontal: 20, paddingVertical: 4 },
  newCat: { width: 90, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', shadowOpacity: 0 },
  list: { paddingHorizontal: 16 },
  rowWrap: {},
  more: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 14, alignItems: 'center' },
  remRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.md },
  remSettings: { paddingVertical: 14 },
});
