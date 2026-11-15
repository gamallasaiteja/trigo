import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, Clock3, X } from 'lucide-react-native';
import type { DateKey } from '@/models/types';
import { useApp } from '@/store/AppStore';
import { radius, useTheme } from '@/theme';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Text } from '@/components/Text';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/EmptyState';
import { TrophyIllustration } from '@/components/Illustrations';
import {
  categoryStats,
  countStatuses,
  monthCalendar,
  pct,
  performanceSummary,
  rate,
  recentDays,
  tasksBetween,
  type CalendarDay,
} from '@/logic/analytics';
import { generateInsights } from '@/logic/insights';
import { addMonths, endOfMonth, formatMonthYear, formatRelativeDate, startOfMonth, WEEKDAYS_SHORT, weekday } from '@/logic/dates';

export default function Progress() {
  const { data, today } = useApp();
  const theme = useTheme();
  const { colors } = theme;
  const weekStart = data.settings.weekStart;
  const [month, setMonth] = useState<DateKey>(startOfMonth(today));
  const [selected, setSelected] = useState<DateKey | null>(null);
  const [barSel, setBarSel] = useState<number>(6);

  const isCurrentMonth = month === startOfMonth(today);
  const monthEnd = endOfMonth(month);
  const monthTasks = useMemo(() => tasksBetween(data.tasks, month, monthEnd), [data.tasks, month, monthEnd]);
  // Rate only counts days that have happened.
  const monthDue = useMemo(() => monthTasks.filter((t) => t.dueDate <= today), [monthTasks, today]);
  const monthCounts = countStatuses(monthDue);
  const monthRate = rate(countStatuses(monthDue));
  const weeks = useMemo(() => monthCalendar(data.tasks, month, weekStart, today), [data.tasks, month, weekStart, today]);
  const summary = useMemo(() => performanceSummary(data.tasks, data.categories, today, weekStart), [data.tasks, data.categories, today, weekStart]);
  const insights = useMemo(() => generateInsights(data.tasks, data.categories, today, weekStart), [data.tasks, data.categories, today, weekStart]);
  const days = useMemo(() => recentDays(data.tasks, today, 7), [data.tasks, today]);
  const cats = useMemo(
    () => categoryStats(monthDue, data.categories).filter((c) => c.counts.total > 0).sort((a, b) => b.counts.total - a.counts.total),
    [monthDue, data.categories],
  );
  const names = [...WEEKDAYS_SHORT.slice(weekStart), ...WEEKDAYS_SHORT.slice(0, weekStart)];
  const selectedDay = selected ? weeks.flat().find((d) => d.date === selected) : null;

  const message =
    monthRate === null
      ? month > today
        ? 'This month hasn’t started yet.'
        : 'No tasks were due yet this month.'
      : monthRate >= 0.8
        ? 'Great job! Keep it up! 👏'
        : monthRate >= 0.5
          ? 'Solid progress. Keep moving! 💪'
          : 'Every completed task counts. 🌱';

  return (
    <Screen header={<Header title="Monthly Progress" leading="none" />}>
      <View style={styles.monthNav}>
        <Pressable hitSlop={12} onPress={() => { setMonth(addMonths(month, -1)); setSelected(null); }} accessibilityLabel="Previous month">
          <ChevronLeft size={20} color={colors.text} />
        </Pressable>
        <Text variant="subheading" testID="progress-month">{formatMonthYear(month)}</Text>
        <Pressable hitSlop={12} onPress={() => { setMonth(addMonths(month, 1)); setSelected(null); }} accessibilityLabel="Next month">
          <ChevronRight size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* Overall */}
      <Card style={[styles.overall, { backgroundColor: colors.lavender }]}>
        <View style={styles.flex}>
          <Text variant="smallStrong">{isCurrentMonth ? 'This month so far' : 'Month completion'}</Text>
          <Text variant="display" color={colors.todo} style={styles.big} testID="progress-month-pct">
            {monthRate === null ? '–' : `${pct(monthRate)}%`}
          </Text>
          <ProgressBar value={monthRate ?? 0} color={colors.todo} trackColor={colors.card} />
          <Text variant="small" tone="secondary" style={styles.msg}>
            {message}
          </Text>
        </View>
        <TrophyIllustration size={88} />
      </Card>

      {/* Calendar */}
      <Card style={styles.calendar}>
        <View style={styles.week}>
          {names.map((n) => (
            <Text key={n} variant="caption" tone="secondary" style={styles.dayName}>
              {n}
            </Text>
          ))}
        </View>
        {weeks.map((w) => (
          <View key={w[0].date} style={styles.week}>
            {w.map((d) => (
              <DayCell key={d.date} day={d} selected={selected === d.date} onPress={() => setSelected(selected === d.date ? null : d.date)} />
            ))}
          </View>
        ))}
        <View style={styles.legend}>
          <Legend icon={<Dot kind="done" />} label="All done" />
          <Legend icon={<Dot kind="partial" />} label="Partly done" />
          <Legend icon={<Dot kind="open" />} label="To do" />
          <Legend icon={<Dot kind="missed" />} label="Missed" />
        </View>
        {selectedDay ? (
          <Pressable
            onPress={() => router.push(`/tasks?date=${selectedDay.date}`)}
            style={[styles.daySummary, { backgroundColor: colors.cardAlt }]}
            accessibilityRole="button"
          >
            <View style={styles.flex}>
              <Text variant="smallStrong">{formatRelativeDate(selectedDay.date, today)}</Text>
              <Text variant="small" tone="secondary">
                {selectedDay.counts.total === 0
                  ? 'No tasks'
                  : `${selectedDay.counts.completed} of ${selectedDay.counts.total} completed${selectedDay.counts.inProgress ? ` · ${selectedDay.counts.inProgress} in progress` : ''}`}
              </Text>
            </View>
            <Text variant="smallStrong" tone="primary">
              View tasks
            </Text>
          </Pressable>
        ) : null}
      </Card>

      {/* Breakdown */}
      <SectionHeader title="Breakdown" right={<Text variant="caption" tone="secondary" style={styles.flex}>  tasks due so far</Text>} />
      <View style={styles.breakdown}>
        <BreakdownCard bg={colors.primarySoft} fg={colors.success} icon={<Check size={16} color="#fff" strokeWidth={3} />} solid label="Completed" value={monthCounts.completed} />
        <BreakdownCard bg={colors.warningSoft} fg={colors.warning} icon={<Clock3 size={16} color={colors.warning} />} label="In Progress" value={monthCounts.inProgress} />
        <BreakdownCard bg={colors.todoSoft} fg={colors.todo} label="To Do" value={monthCounts.todo} />
      </View>

      {/* Performance summary */}
      <SectionHeader title="Performance" />
      {summary.dueSoFar === 0 ? (
        <Card>
          <EmptyState compact emoji="📊" title="No data yet" message="Complete a few tasks and your completion rates will show up here." />
        </Card>
      ) : (
        <>
          <View style={styles.grid}>
            <StatTile label="Overall rate" value={summary.overallRate === null ? '–' : `${pct(summary.overallRate)}%`} hint={`${summary.dueSoFar} tasks due so far`} />
            <StatTile label="This week" value={summary.weekRate === null ? '–' : `${pct(summary.weekRate)}%`} hint="tasks due so far" />
            <StatTile label="This month" value={summary.monthRate === null ? '–' : `${pct(summary.monthRate)}%`} hint="tasks due so far" />
            <StatTile label="Completed" value={String(summary.totalCompleted)} hint="all time" />
            <StatTile label="Current streak" value={`${summary.currentStreak} ${summary.currentStreak === 1 ? 'day' : 'days'}`} hint="every task done" />
            <StatTile
              label="Most consistent"
              value={summary.mostConsistent ? summary.mostConsistent.category.emoji : '–'}
              hint={summary.mostConsistent ? `${summary.mostConsistent.category.name} · ${pct(summary.mostConsistent.rate)}%` : 'needs 3+ tasks in a category'}
            />
          </View>

          {/* Last 7 days */}
          <Card style={styles.chartCard}>
            <View style={styles.chartHead}>
              <Text variant="subheading">Last 7 days</Text>
              <Text variant="small" tone="secondary">
                {days[barSel].counts.total === 0
                  ? `${formatRelativeDate(days[barSel].date, today)}: no tasks`
                  : `${formatRelativeDate(days[barSel].date, today)}: ${pct(days[barSel].rate)}% · ${days[barSel].counts.completed}/${days[barSel].counts.total}`}
              </Text>
            </View>
            <View style={styles.chart} accessibilityLabel={days.map((d) => `${formatRelativeDate(d.date, today)} ${d.counts.total ? `${pct(d.rate)} percent` : 'no tasks'}`).join(', ')}>
              {[0, 0.5, 1].map((g) => (
                <View key={g} style={[styles.gridLine, { bottom: g * 100, borderColor: colors.border }]} />
              ))}
              {days.map((d, i) => (
                <Pressable key={d.date} onPress={() => setBarSel(i)} style={styles.barHit} accessibilityLabel={`${formatRelativeDate(d.date, today)}, ${d.counts.total ? `${pct(d.rate)}%` : 'no tasks'}`}>
                  <View style={styles.barTrack}>
                    {d.counts.total > 0 ? (
                      <View
                        style={[
                          styles.bar,
                          {
                            height: Math.max(4, (d.rate ?? 0) * 100),
                            backgroundColor: colors.primary,
                            opacity: barSel === i ? 1 : 0.55,
                          },
                        ]}
                      />
                    ) : (
                      <View style={[styles.noBar, { backgroundColor: colors.track }]} />
                    )}
                  </View>
                  <Text variant="caption" color={barSel === i ? colors.text : colors.textSecondary}>
                    {WEEKDAYS_SHORT[weekday(d.date)].slice(0, 2)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text variant="caption" tone="muted">Daily completion rate · tap a bar for details</Text>
          </Card>

          {cats.length > 0 ? (
            <Card style={styles.catCard}>
              <Text variant="subheading" style={styles.catTitle}>
                By category · {formatMonthYear(month)}
              </Text>
              {cats.map((c) => {
                const cc = theme.category(c.category.color);
                return (
                  <View key={c.category.id} style={styles.catRow}>
                    <Text style={styles.catEmoji}>{c.category.emoji}</Text>
                    <View style={styles.flex}>
                      <View style={styles.catLabelRow}>
                        <Text variant="smallStrong">{c.category.name}</Text>
                        <Text variant="small" tone="secondary">
                          {c.counts.completed}/{c.counts.total} · {pct(c.rate)}%
                        </Text>
                      </View>
                      <ProgressBar value={c.rate ?? 0} color={cc.fg} height={6} />
                    </View>
                  </View>
                );
              })}
            </Card>
          ) : null}
        </>
      )}

      {/* Insights */}
      <SectionHeader title="Insights" />
      {insights.length === 0 ? (
        <Card>
          <EmptyState
            compact
            emoji="🔎"
            title="Insights are on their way"
            message="Mitdo only shares observations backed by your own activity. Keep tracking for a few days and they’ll appear here."
          />
        </Card>
      ) : (
        <View style={styles.insights}>
          {insights.map((i) => (
            <Card
              key={i.id}
              style={[
                styles.insight,
                { backgroundColor: i.tone === 'positive' ? colors.primarySoft : i.tone === 'attention' ? colors.warningSoft : colors.card },
              ]}
            >
              <Text style={styles.insightEmoji}>{i.emoji}</Text>
              <Text variant="small" style={styles.flex}>
                {i.text}
              </Text>
            </Card>
          ))}
        </View>
      )}

      <Card style={[styles.quote, { backgroundColor: colors.cream }]}>
        <Text style={styles.insightEmoji}>⭐</Text>
        <Text variant="smallStrong" style={styles.flex}>
          “The small habits you do every day lead to big changes.” 🌱
        </Text>
      </Card>
    </Screen>
  );
}

function Dot({ kind }: { kind: 'done' | 'partial' | 'open' | 'missed' }) {
  const { colors } = useTheme();
  const size = 18;
  const base = { width: size, height: size, borderRadius: size / 2, alignItems: 'center' as const, justifyContent: 'center' as const };
  if (kind === 'done')
    return (
      <View style={[base, { backgroundColor: colors.success }]}>
        <Check size={11} color="#fff" strokeWidth={3.5} />
      </View>
    );
  if (kind === 'partial')
    return (
      <View style={[base, { borderWidth: 2, borderColor: colors.warning }]}>
        <Clock3 size={10} color={colors.warning} strokeWidth={3} />
      </View>
    );
  if (kind === 'missed')
    return (
      <View style={[base, { borderWidth: 2, borderColor: colors.danger }]}>
        <X size={10} color={colors.danger} strokeWidth={3} />
      </View>
    );
  return <View style={[base, { borderWidth: 2, borderColor: colors.todo }]} />;
}

function DayCell({ day, selected, onPress }: { day: CalendarDay; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const kind = day.state === 'done' ? 'done' : day.state === 'partial' ? 'partial' : day.state === 'missed' ? 'missed' : day.state === 'empty' ? null : 'open';
  return (
    <Pressable
      onPress={onPress}
      style={[styles.cell, selected && { backgroundColor: colors.primarySoft }, day.isToday && { borderWidth: 1.5, borderColor: colors.primary }]}
      accessibilityLabel={`${day.date}: ${day.counts.total ? `${day.counts.completed} of ${day.counts.total} completed` : 'no tasks'}`}
      accessibilityState={{ selected }}
    >
      <Text variant="smallStrong" color={day.inMonth ? colors.text : colors.textMuted}>
        {Number(day.date.slice(8))}
      </Text>
      <View style={[styles.cellIcon, !day.inMonth && { opacity: 0.35 }]}>
        {kind ? <Dot kind={kind} /> : <View style={[styles.emptyDot, { backgroundColor: colors.track }]} />}
      </View>
    </Pressable>
  );
}

function Legend({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.legendItem}>
      {icon}
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

function BreakdownCard({ bg, fg, icon, label, value, solid }: { bg: string; fg: string; icon?: React.ReactNode; label: string; value: number; solid?: boolean }) {
  return (
    <View style={[styles.bd, { backgroundColor: bg }]}>
      <View style={[styles.bdIcon, solid ? { backgroundColor: fg } : { borderWidth: 2, borderColor: fg }]}>{icon}</View>
      <Text variant="small" tone="secondary">
        {label}
      </Text>
      <Text variant="title">{value}</Text>
      <Text variant="caption" tone="secondary">
        tasks
      </Text>
    </View>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card style={styles.tile}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="title" style={styles.tileValue} numberOfLines={1}>
        {value}
      </Text>
      <Text variant="caption" tone="muted" numberOfLines={2} style={styles.tileHint}>
        {hint}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 14 },
  overall: { flexDirection: 'row', alignItems: 'center', gap: 12, shadowOpacity: 0 },
  big: { marginVertical: 6, fontSize: 34 },
  msg: { marginTop: 8 },
  calendar: { marginTop: 16, paddingHorizontal: 10 },
  week: { flexDirection: 'row' },
  dayName: { flex: 1, textAlign: 'center', marginBottom: 6 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: radius.md, gap: 4, margin: 1 },
  cellIcon: { height: 18, justifyContent: 'center' },
  emptyDot: { width: 6, height: 6, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  daySummary: { flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 12, borderRadius: radius.md },
  breakdown: { flexDirection: 'row', gap: 10 },
  bd: { flex: 1, borderRadius: radius.lg, padding: 14, gap: 2 },
  bdIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '31%', flexGrow: 1, padding: 12, minWidth: 96 },
  tileValue: { marginTop: 4, fontSize: 20 },
  tileHint: { marginTop: 2 },
  chartCard: { marginTop: 12 },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 4 },
  chart: { flexDirection: 'row', height: 124, alignItems: 'flex-end', marginBottom: 8 },
  gridLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, marginBottom: 22 },
  barHit: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { height: 100, justifyContent: 'flex-end' },
  bar: { width: 16, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  noBar: { width: 16, height: 2, borderRadius: 1 },
  catCard: { marginTop: 12 },
  catTitle: { marginBottom: 6 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  catEmoji: { fontSize: 20 },
  catLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  insights: { gap: 10 },
  insight: { flexDirection: 'row', alignItems: 'center', gap: 12, shadowOpacity: 0 },
  insightEmoji: { fontSize: 20 },
  quote: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, shadowOpacity: 0 },
});
