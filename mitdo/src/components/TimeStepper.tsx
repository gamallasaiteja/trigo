import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import type { TimeKey } from '@/models/types';
import { minutesToTime, timeToMinutes } from '@/logic/dates';
import { radius, useTheme } from '@/theme';
import { Text } from './Text';

function Col({ label, up, down, a11y }: { label: string; up: () => void; down: () => void; a11y: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.col}>
      <Pressable onPress={up} hitSlop={8} accessibilityLabel={`Increase ${a11y}`} style={[styles.btn, { backgroundColor: colors.cardAlt }]}>
        <ChevronUp size={18} color={colors.text} />
      </Pressable>
      <Text variant="title" style={styles.value}>
        {label}
      </Text>
      <Pressable onPress={down} hitSlop={8} accessibilityLabel={`Decrease ${a11y}`} style={[styles.btn, { backgroundColor: colors.cardAlt }]}>
        <ChevronDown size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

/** Hour / minute / AM-PM stepper. Minutes move in 5-minute steps. */
export function TimeStepper({ value, onChange }: { value: TimeKey; onChange: (t: TimeKey) => void }) {
  const { colors } = useTheme();
  const mins = timeToMinutes(value);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const pm = h >= 12;
  const set = (next: number) => onChange(minutesToTime(next));
  const roundTo5 = (x: number) => Math.round(x / 5) * 5;

  return (
    <View style={styles.row}>
      <Col label={String(h12)} a11y="hour" up={() => set(mins + 60)} down={() => set(mins - 60)} />
      <Text variant="title">:</Text>
      <Col
        label={String(m).padStart(2, '0')}
        a11y="minutes"
        up={() => set(h * 60 + ((roundTo5(m) + 5) % 60))}
        down={() => set(h * 60 + ((roundTo5(m) - 5 + 60) % 60))}
      />
      <View style={[styles.ampm, { backgroundColor: colors.cardAlt }]}>
        {(['AM', 'PM'] as const).map((p) => {
          const active = (p === 'PM') === pm;
          return (
            <Pressable
              key={p}
              onPress={() => !active && set(mins + (p === 'PM' ? 720 : -720))}
              accessibilityState={{ selected: active }}
              style={[styles.ampmBtn, active && { backgroundColor: colors.primary }]}
            >
              <Text variant="smallStrong" color={active ? colors.onPrimary : colors.textSecondary}>
                {p}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 6 },
  col: { alignItems: 'center', gap: 6 },
  btn: { width: 44, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 44, textAlign: 'center' },
  ampm: { borderRadius: radius.md, padding: 4, gap: 4, marginLeft: 6 },
  ampmBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm },
});
