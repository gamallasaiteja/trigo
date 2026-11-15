import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { DateKey } from '@/models/types';
import { addMonths, formatMonthYear, startOfMonth, WEEKDAYS_SHORT } from '@/logic/dates';
import { monthCalendar } from '@/logic/analytics';
import { radius, useTheme } from '@/theme';
import { Text } from './Text';

interface Props {
  value: DateKey;
  onChange: (d: DateKey) => void;
  today: DateKey;
  weekStart: 0 | 1;
  /** Disallow dates before this (e.g. today when rescheduling). */
  minDate?: DateKey;
}

/** Lightweight inline date picker that looks the same on every platform. */
export function MiniCalendar({ value, onChange, today, weekStart, minDate }: Props) {
  const { colors } = useTheme();
  const [month, setMonth] = useState(startOfMonth(value));
  const weeks = monthCalendar([], month, weekStart, today);
  const names = [...WEEKDAYS_SHORT.slice(weekStart), ...WEEKDAYS_SHORT.slice(0, weekStart)];
  return (
    <View>
      <View style={styles.head}>
        <Pressable onPress={() => setMonth(addMonths(month, -1))} hitSlop={10} accessibilityLabel="Previous month">
          <ChevronLeft size={20} color={colors.text} />
        </Pressable>
        <Text variant="subheading">{formatMonthYear(month)}</Text>
        <Pressable onPress={() => setMonth(addMonths(month, 1))} hitSlop={10} accessibilityLabel="Next month">
          <ChevronRight size={20} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.week}>
        {names.map((n) => (
          <Text key={n} variant="caption" tone="secondary" style={styles.cellText}>
            {n.slice(0, 2)}
          </Text>
        ))}
      </View>
      {weeks.map((w) => (
        <View key={w[0].date} style={styles.week}>
          {w.map((d) => {
            const selected = d.date === value;
            const disabled = !!minDate && d.date < minDate;
            return (
              <Pressable
                key={d.date}
                disabled={disabled}
                onPress={() => onChange(d.date)}
                accessibilityLabel={d.date}
                accessibilityState={{ selected, disabled }}
                style={styles.cell}
              >
                <View
                  style={[
                    styles.day,
                    selected && { backgroundColor: colors.primary },
                    !selected && d.isToday && { borderWidth: 1.5, borderColor: colors.primary },
                  ]}
                >
                  <Text
                    variant="smallStrong"
                    color={selected ? colors.onPrimary : disabled || !d.inMonth ? colors.textMuted : colors.text}
                  >
                    {Number(d.date.slice(8))}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 },
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  cellText: { flex: 1, textAlign: 'center', marginBottom: 4 },
  day: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
