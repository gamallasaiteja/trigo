import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

interface Props {
  title: string;
  /** 'back' shows a chevron, 'close' shows an X (for modals). */
  leading?: 'back' | 'close' | 'none';
  onLeading?: () => void;
  right?: React.ReactNode;
}

export function Header({ title, leading = 'back', onLeading, right }: Props) {
  const { colors } = useTheme();
  const goBack = onLeading ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {leading !== 'none' ? (
          <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel={leading === 'close' ? 'Close' : 'Back'} style={[styles.iconBtn, { backgroundColor: colors.card }]}>
            {leading === 'close' ? <X size={20} color={colors.text} /> : <ChevronLeft size={22} color={colors.text} />}
          </Pressable>
        ) : null}
      </View>
      <Text variant="heading" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, minHeight: 56 },
  side: { width: 72, flexDirection: 'row' },
  right: { justifyContent: 'flex-end' },
  title: { flex: 1, textAlign: 'center' },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
