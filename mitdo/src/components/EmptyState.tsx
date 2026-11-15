import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';

interface Props {
  emoji: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({ emoji, title, message, actionLabel, onAction, compact }: Props) {
  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text variant="subheading" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="small" tone="secondary" align="center" style={styles.msg}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} small style={styles.btn} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  compact: { paddingVertical: 18 },
  emoji: { fontSize: 40, marginBottom: 10 },
  msg: { marginTop: 6, maxWidth: 280 },
  btn: { marginTop: 16 },
});
