import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { BarChart3, House, ListChecks, Plus, UserRound } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

const ICONS: Record<string, typeof House> = {
  index: House,
  tasks: ListChecks,
  progress: BarChart3,
  profile: UserRound,
};
const LABELS: Record<string, string> = { index: 'Home', tasks: 'Tasks', progress: 'Progress', profile: 'Profile' };

/** Bottom navigation with a prominent centre "Add" button. */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 10),
          shadowOpacity: dark ? 0 : 0.06,
        },
      ]}
    >
      <View style={styles.inner}>
        {state.routes.map((route, index) => {
          if (route.name === 'add') {
            return (
              <View key={route.key} style={styles.item}>
                <Pressable
                  testID="tab-add"
                  onPress={() => router.push('/task/new')}
                  accessibilityRole="button"
                  accessibilityLabel="Add task"
                  style={({ pressed }) => [
                    styles.add,
                    { backgroundColor: colors.primary, shadowColor: colors.primary, transform: [{ scale: pressed ? 0.94 : 1 }] },
                  ]}
                >
                  <Plus size={28} color={colors.onPrimary} strokeWidth={2.6} />
                </Pressable>
              </View>
            );
          }
          const focused = state.index === index;
          const Icon = ICONS[route.name] ?? House;
          const color = focused ? colors.primary : colors.textMuted;
          return (
            <Pressable
              key={route.key}
              testID={`tab-${route.name}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={LABELS[route.name]}
              onPress={() => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigateToTab(route.key);
              }}
              style={styles.item}
            >
              <Icon size={22} color={color} strokeWidth={focused ? 2.4 : 2} />
              <Text variant="caption" color={color} style={styles.label}>
                {LABELS[route.name]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    shadowColor: '#000',
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  inner: { flexDirection: 'row', alignItems: 'center', maxWidth: 640, width: '100%', alignSelf: 'center' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 48 },
  label: { fontWeight: '600' },
  add: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Platform.OS === 'web' ? -18 : -22,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
