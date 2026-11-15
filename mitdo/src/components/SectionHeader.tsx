import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';

export function SectionHeader({ title, action, onAction, right }: { title: string; action?: string; onAction?: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text variant="heading">{title}</Text>
      {right}
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text variant="smallStrong" tone="primary">
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 12 },
});
