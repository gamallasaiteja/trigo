import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Bell, Repeat } from 'lucide-react-native';
import type { Category, DateKey, Task } from '@/models/types';
import { formatRelativeDate, formatTime } from '@/logic/dates';
import { isMissed, isOverdue } from '@/logic/analytics';
import { useTheme } from '@/theme';
import { StatusIcon } from './StatusIcon';
import { Tag } from './Chip';
import { Text } from './Text';
import { PRIORITY_LABEL, priorityColors } from './taskMeta';

interface Props {
  task: Task;
  category?: Category;
  today: DateKey;
  onToggle: () => void;
  onPress: () => void;
  onLongPress?: () => void;
  showCategory?: boolean;
  showDate?: boolean;
  /** Use the compact "time on the right" layout from the dashboard. */
  variant?: 'list' | 'compact';
}

export function TaskRow({ task, category, today, onToggle, onPress, onLongPress, showCategory = true, showDate, variant = 'list' }: Props) {
  const theme = useTheme();
  const { colors } = theme;
  const done = task.status === 'completed';
  const overdue = isOverdue(task, today);
  const missed = isMissed(task, today);
  const pr = priorityColors(task.priority, theme);
  const cat = category ? theme.category(category.color) : null;

  const timeLabel = task.scheduledTime ? formatTime(task.scheduledTime) : null;
  const a11y = [
    task.title,
    timeLabel,
    category?.name,
    done ? 'completed' : task.status === 'in_progress' ? 'in progress' : 'to do',
    overdue ? 'overdue' : missed ? 'missed' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={a11y}
      accessibilityHint="Opens task details"
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <StatusIcon status={task.status} onPress={onToggle} label={`Mark ${task.title} as ${done ? 'not done' : 'done'}`} />
      <View style={styles.body}>
        <Text
          variant="bodyStrong"
          numberOfLines={1}
          style={done ? { textDecorationLine: 'line-through', color: colors.textSecondary } : undefined}
        >
          {task.title}
        </Text>
        <View style={styles.meta}>
          {overdue ? <Tag label={`Overdue · ${formatRelativeDate(task.dueDate, today)}`} fg={colors.danger} bg={colors.dangerSoft} /> : null}
          {missed ? <Tag label="Missed" fg={colors.textSecondary} bg={colors.cardAlt} /> : null}
          {showDate && !overdue ? <Text variant="small" tone="secondary">{formatRelativeDate(task.dueDate, today)}</Text> : null}
          {variant === 'list' && timeLabel ? (
            <Text variant="small" tone="secondary">
              {timeLabel}
            </Text>
          ) : null}
          {showCategory && category && cat ? <Tag label={`${category.emoji} ${category.name}`} fg={cat.fg} bg={cat.bg} /> : null}
          {pr ? <Tag label={PRIORITY_LABEL[task.priority]} fg={pr.fg} bg={pr.bg} /> : null}
        </View>
      </View>
      <View style={styles.right}>
        {variant === 'compact' && timeLabel ? (
          <Text variant="smallStrong" tone="secondary">
            {timeLabel}
          </Text>
        ) : null}
        <View style={styles.icons}>
          {task.seriesId ? <Repeat size={14} color={colors.textMuted} accessibilityLabel="Repeats" /> : null}
          {task.reminder && task.scheduledTime ? <Bell size={14} color={done ? colors.textMuted : colors.primary} accessibilityLabel="Reminder set" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  body: { flex: 1, gap: 5 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  right: { alignItems: 'flex-end', gap: 4 },
  icons: { flexDirection: 'row', gap: 6 },
});
