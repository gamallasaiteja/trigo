import React, { useEffect, useState } from 'react';
import { Animated, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

interface Props {
  value: number; // 0..1
  color?: string;
  trackColor?: string;
  height?: number;
  style?: ViewStyle;
}

export function ProgressBar({ value, color, trackColor, height = 8, style }: Props) {
  const { colors } = useTheme();
  const [anim] = useState(() => new Animated.Value(value));
  useEffect(() => {
    Animated.timing(anim, { toValue: Math.max(0, Math.min(1, value)), duration: 450, useNativeDriver: false }).start();
  }, [value, anim]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={[{ height, borderRadius: height, backgroundColor: trackColor ?? colors.track, overflow: 'hidden' }, style]}
    >
      <Animated.View style={{ width, height: '100%', borderRadius: height, backgroundColor: color ?? colors.primary }} />
    </View>
  );
}
