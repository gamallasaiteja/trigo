import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

interface Props {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  toggle?: { value: boolean; onChange: (v: boolean) => void };
  destructive?: boolean;
  last?: boolean;
  testID?: string;
}

export function SettingRow({ icon, title, subtitle, value, onPress, toggle, destructive, last, testID }: Props) {
  const { colors } = useTheme();
  const content = (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      {icon ? <View style={[styles.icon, { backgroundColor: destructive ? colors.dangerSoft : colors.primarySoft }]}>{icon}</View> : null}
      <View style={styles.body}>
        <Text variant="bodyStrong" color={destructive ? colors.danger : colors.text}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="small" tone="secondary">
          {value}
        </Text>
      ) : null}
      {toggle ? (
        <Switch
          testID={testID}
          value={toggle.value}
          onValueChange={toggle.onChange}
          trackColor={{ true: colors.primary, false: colors.track }}
          thumbColor="#FFFFFF"
          accessibilityLabel={title}
        />
      ) : onPress ? (
        <ChevronRight size={18} color={colors.textMuted} />
      ) : null}
    </View>
  );
  if (!onPress || toggle) return content;
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
});
