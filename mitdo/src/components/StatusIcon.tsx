import React, { useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { Check, Clock3 } from 'lucide-react-native';
import type { TaskStatus } from '@/models/types';
import { useTheme } from '@/theme';

interface Props {
  status: TaskStatus;
  onPress?: () => void;
  size?: number;
  label?: string;
}

/** Green check = done, orange clock = in progress, purple ring = to do. */
export function StatusIcon({ status, onPress, size = 26, label }: Props) {
  const { colors } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.8, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
    onPress?.();
  };
  const ring = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  const inner =
    status === 'completed' ? (
      <Animated.View style={[ring, { backgroundColor: colors.success, borderColor: colors.success, transform: [{ scale }] }]}>
        <Check size={size * 0.6} color="#fff" strokeWidth={3} />
      </Animated.View>
    ) : status === 'in_progress' ? (
      <Animated.View style={[ring, { borderColor: colors.warning, transform: [{ scale }] }]}>
        <Clock3 size={size * 0.58} color={colors.warning} strokeWidth={2.5} />
      </Animated.View>
    ) : (
      <Animated.View style={[ring, { borderColor: colors.todo, transform: [{ scale }] }]} />
    );
  if (!onPress) return inner;
  return (
    <Pressable
      onPress={press}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: status === 'completed' }}
      accessibilityLabel={label}
      style={styles.hit}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({ hit: { padding: 2 } });
