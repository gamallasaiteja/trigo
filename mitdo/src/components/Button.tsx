import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { radius, useTheme } from '@/theme';
import { Text } from './Text';

type Kind = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props {
  title: string;
  onPress?: () => void;
  kind?: Kind;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  small?: boolean;
  testID?: string;
}

export function Button({ title, onPress, kind = 'primary', icon, disabled, loading, style, small, testID }: Props) {
  const { colors } = useTheme();
  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary },
    secondary: { bg: colors.primarySoft, fg: colors.primaryDark },
    ghost: { bg: 'transparent', fg: colors.primary },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  }[kind];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        { backgroundColor: palette.bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text variant={small ? 'smallStrong' : 'bodyStrong'} color={palette.fg}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  small: { height: 38, borderRadius: radius.md, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
