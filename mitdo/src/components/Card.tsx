import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, useTheme } from '@/theme';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
  accessibilityLabel?: string;
}

export function Card({ children, style, onPress, padded = true, accessibilityLabel }: Props) {
  const { colors, dark } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: padded ? 16 : 0,
    borderWidth: dark ? 1 : 0,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: dark ? 0 : 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: dark ? 0 : 1,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [base, style, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

const styles = StyleSheet.create({ pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] } });
