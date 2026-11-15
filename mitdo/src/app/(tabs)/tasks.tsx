import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X } from 'lucide-react-native';
import type { DateKey, Task, TaskStatus } from '@/models/types';
import { useApp } from '@/store/AppStore';
import { radius, useTheme } from '@/theme';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Text } from '@/components/Text';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { TaskRow } from '@/components/TaskRow';
import { EmptyState } from '@/components/EmptyState';
import { TaskQuickActions } from '@/components/TaskQuickActions';
import { compareTasks, overdueTasks } from '@/logic/analytics';
import { addDays, formatRelativeDate, startOfWeek, weekday, WEEKDAYS_SHORT, formatMonthYear } from '@/logic/dates';
import { useToggleTask } from '@/hooks/useTaskActions';

type Filter = 'all' | TaskStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Done' },
];

export default function Tasks() {
  const { data, today } = useApp();
  const theme = useTheme();
  const { colors } = theme;
  const toggle = useToggleTask();
  const params = useLocalSearchParams<{ scope?: string; category?: string; date?: string }>();

  const [filter, setFilter] = useState<Filter>('all');
  const [day, setDay] = useState<DateKey>(today);
  const [showOverdue, setShowOverdue] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [menuTask, setMenuTask] = useState<Task | null>(null);
  const [weekAnchor, setWeekAnchor] = useState<DateKey>(today);

  // Apply deep-link params (from dashboard cards / banners) once per new link.
  const paramKey = `${params.scope ?? ''}|${params.category ?? ''}|${params.date ?? ''}`;
  const [appliedKey, setAppliedKey] = useState('||');
  if (paramKey !== appliedKey) {
    setAppliedKey(paramKey);
    if (params.scope === 'overdue') setShowOverdue(true);
    if (params.category) {
      setCategoryId(params.category);
      setShowOverdue(false);
      setDay(today);
      setWeekAnchor(today);
    }
    if (params.date) {
      setDay(params.date);
      setWeekAnchor(params.date);
      setShowOverdue(false);
    }
  }
  // Clear the params so tapping the same link again works.
  useEffect(() => {
    if (paramKey !== '||') router.setParams({ scope: undefined, category: undefined, date: undefined });
  }, [paramKey]);

  const overdue = useMemo(() => overdueTasks(data.tasks, today), [data.tasks, today]);
  const overdueView = showOverdue && overdue.length > 0;

  const weekStartKey = startOfWeek(weekAnchor, data.settings.weekStart);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStartKey, i));
  const countByDay = useMemo(() => {
    const m = new Map<DateKey, number>();
    for (const t of data.tasks) m.set(t.dueDate, (m.get(t.dueDate) ?? 0) + 1);
    return m;
  }, [data.tasks]);

  const base = overdueView ? overdue : data.tasks.filter((t) => t.dueDate === day);
  const visible = base
    .filter((t) => (filter === 'all' ? true : t.status === filter))
    .filter((t) => (categoryId ? t.categoryId === categoryId : true))
    .sort(compareTasks);

  const groups = data.categories
    .map((c) => ({ category: c, tasks: visible.filter((t) => t.categoryId === c.id) }))
    .filter((g) => g.tasks.length > 0);
  // Tasks whose category no longer exists (shouldn't happen, but never hide data).
  const orphans = visible.filter((t) => !data.categories.some((c) => c.id === t.categoryId));

  const activeCategory = data.categories.find((c) => c.id === categoryId);

  return (
    <Screen header={<Header title="My Tasks" leading="none" />}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={styles.filtersScroll}>
        {FILTERS.map((f) => (
          <Chip key={f.key} testID={`filter-${f.key}`} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ScrollView>

      {/* Week strip */}
      <Card style={styles.weekCard}>
        <View style={styles.weekHead}>
          <Pressable hitSlop={10} onPress={() => setWeekAnchor(addDays(weekAnchor, -7))} accessibilityLabel="Previous week">
            <ChevronLeft size={20} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            onPress={() => {
              setWeekAnchor(today);
              setDay(today);
              setShowOverdue(false);
            }}
          >
            <Text variant="smallStrong">{formatMonthYear(weekStartKey)}</Text>
          </Pressable>
          <Pressable hitSlop={10} onPress={() => setWeekAnchor(addDays(weekAnchor, 7))} accessibilityLabel="Next week">
            <ChevronRight size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.weekRow}>
          {week.map((d) => {
            const selected = !overdueView && d === day;
            const isToday = d === today;
            const n = countByDay.get(d) ?? 0;
            return (
              <Pressable
                key={d}
                testID={`day-${d}`}
                onPress={() => {
                  setDay(d);
                  setShowOverdue(false);
                }}
                accessibilityLabel={`${formatRelativeDate(d, today)}, ${n} tasks`}
                accessibilityState={{ selected }}
                style={[styles.dayCell, selected && { backgroundColor: colors.primary }]}
              >
                <Text variant="caption" color={selected ? colors.onPrimary : colors.textSecondary}>
                  {WEEKDAYS_SHORT[weekday(d)]}
                </Text>
                <Text variant="subheading" color={selected ? colors.onPrimary : isToday ? colors.primary : colors.text}>
                  {Number(d.slice(8))}
                </Text>
                <View style={[styles.dayDot, { backgroundColor: n ? (selected ? colors.onPrimary : colors.primary) : 'transparent' }]} />
              </Pressable>
            );
          })}
        </View>
      </Card>

      <View style={styles.scopeRow}>
        <Text variant="heading" style={styles.flex}>
          {overdueView ? 'Overdue' : formatRelativeDate(day, today)}
        </Text>
        {overdue.length > 0 && !overdueView ? (
          <Pressable onPress={() => setShowOverdue(true)} accessibilityRole="button" style={[styles.overduePill, { backgroundColor: colors.dangerSoft }]}>
            <Text variant="smallStrong" color={colors.danger}>
              {overdue.length} overdue
            </Text>
          </Pressable>
        ) : null}
        {activeCategory ? (
          <Pressable
            onPress={() => setCategoryId(null)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${activeCategory.name} filter`}
            style={[styles.catFilter, { backgroundColor: theme.category(activeCategory.color).bg }]}
          >
            <Text variant="smallStrong" color={theme.category(activeCategory.color).fg}>
              {activeCategory.emoji} {activeCategory.name}
            </Text>
            <X size={14} color={theme.category(activeCategory.color).fg} />
          </Pressable>
        ) : null}
      </View>

      {groups.length === 0 && orphans.length === 0 ? (
        <Card>
          <EmptyState
            emoji={filter === 'completed' ? '🌱' : base.length > 0 ? '🔍' : day < today && !overdueView ? '📖' : '✨'}
            title={
              base.length > 0
                ? 'No tasks match this filter'
                : day < today
                  ? 'Nothing was planned this day'
                  : 'Nothing planned yet'
            }
            message={base.length > 0 ? 'Try another filter to see the rest.' : day < today ? undefined : 'Add something that matters for this day.'}
            actionLabel={base.length === 0 && day >= today ? 'Add a task' : undefined}
            onAction={() => router.push(`/task/new?date=${day}`)}
          />
        </Card>
      ) : null}

      {groups.map(({ category, tasks }) => {
        const isCollapsed = !!collapsed[category.id];
        return (
          <View key={category.id} style={styles.group}>
            <Pressable
              onPress={() => setCollapsed({ ...collapsed, [category.id]: !isCollapsed })}
              style={styles.groupHead}
              accessibilityRole="button"
              accessibilityState={{ expanded: !isCollapsed }}
            >
              <Text style={styles.groupEmoji}>{category.emoji}</Text>
              <Text variant="subheading">{category.name}</Text>
              <Text variant="small" tone="secondary" style={styles.flex}>
                {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
              </Text>
              {isCollapsed ? <ChevronDown size={18} color={colors.textSecondary} /> : <ChevronUp size={18} color={colors.textSecondary} />}
            </Pressable>
            {!isCollapsed ? (
              <Card padded={false} style={styles.groupCard}>
                {tasks.map((t, i) => (
                  <View key={t.id} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : undefined}>
                    <TaskRow
                      task={t}
                      today={today}
                      showCategory={false}
                      showDate={overdueView}
                      onToggle={() => toggle(t.id)}
                      onPress={() => router.push(`/task/${t.id}`)}
                      onLongPress={() => setMenuTask(t)}
                    />
                  </View>
                ))}
              </Card>
            ) : null}
          </View>
        );
      })}
      {orphans.length > 0 ? (
        <Card padded={false} style={styles.groupCard}>
          {orphans.map((t) => (
            <TaskRow key={t.id} task={t} today={today} onToggle={() => toggle(t.id)} onPress={() => router.push(`/task/${t.id}`)} />
          ))}
        </Card>
      ) : null}

      {visible.length > 0 ? (
        <Text variant="caption" tone="muted" align="center" style={styles.hint}>
          Tip: tap the circle to complete · long-press a task for more options
        </Text>
      ) : null}

      <TaskQuickActions task={menuTask} onClose={() => setMenuTask(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filtersScroll: { marginHorizontal: -20 },
  filters: { gap: 8, paddingHorizontal: 20, paddingVertical: 4 },
  weekCard: { marginTop: 14, paddingVertical: 12, paddingHorizontal: 10 },
  weekHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, marginBottom: 8 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.lg, gap: 2, marginHorizontal: 2 },
  dayDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, marginBottom: 6, flexWrap: 'wrap' },
  overduePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  catFilter: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  group: { marginTop: 14 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  groupEmoji: { fontSize: 18 },
  groupCard: { paddingHorizontal: 14 },
  hint: { marginTop: 20 },
});
