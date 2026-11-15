import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Category } from '@/models/types';
import type { StatusCounts } from '@/logic/analytics';
import { radius, useTheme } from '@/theme';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';
import { Text } from './Text';

export function CategoryCard({ category, counts, onPress, caption }: { category: Category; counts: StatusCounts; onPress?: () => void; caption: string }) {
  const theme = useTheme();
  const c = theme.category(category.color);
  const r = counts.total ? counts.completed / counts.total : 0;
  return (
    <Card onPress={onPress} style={styles.card} accessibilityLabel={`${category.name}, ${counts.total} tasks ${caption}`}>
      <View style={[styles.emojiWrap, { backgroundColor: c.bg }]}>
        <Text style={styles.emoji}>{category.emoji}</Text>
      </View>
      <Text variant="smallStrong" numberOfLines={1} style={styles.name}>
        {category.name}
      </Text>
      <Text variant="caption" tone="secondary" style={styles.count}>
        {counts.total === 0 ? `No tasks ${caption}` : `${counts.completed}/${counts.total} done ${caption}`}
      </Text>
      <ProgressBar value={r} color={c.fg} height={5} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { width: 132, padding: 14 },
  emojiWrap: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emoji: { fontSize: 22 },
  name: { marginBottom: 2 },
  count: { marginBottom: 10, fontWeight: '500' },
});
