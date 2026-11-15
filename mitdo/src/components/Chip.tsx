import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, useTheme } from '@/theme';
import { Text } from './Text';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
  color?: string;
  testID?: string;
}

/** Selectable pill used for filters and form options. */
export function Chip({ label, selected, onPress, icon, color, testID }: Props) {
  const { colors } = useTheme();
  const accent = color ?? colors.primary;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? accent : colors.card,
          borderColor: selected ? accent : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        {icon}
        <Text variant="smallStrong" color={selected ? colors.onPrimary : colors.text}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/** Small, non-interactive coloured label (e.g. "Morning", "Important"). */
export function Tag({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text variant="caption" color={fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 16, height: 38, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, alignSelf: 'flex-start' },
});
