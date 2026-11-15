import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, SplashScreen } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStoreProvider, useApp } from '@/store/AppStore';
import { ThemeProvider, useTheme } from '@/theme';
import { ToastProvider } from '@/components/Toast';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { onNotificationAction } from '@/services/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStoreProvider>
        <ThemedApp />
      </AppStoreProvider>
    </SafeAreaProvider>
  );
}

function ThemedApp() {
  const { data } = useApp();
  return (
    <ThemeProvider preference={data.settings.theme}>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </ThemeProvider>
  );
}

function AppShell() {
  const { ready, loadError, actions } = useApp();
  const { colors, dark } = useTheme();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 32 }]}>
        <Text variant="title" align="center">We couldn’t open your data</Text>
        <Text tone="secondary" align="center" style={{ marginVertical: 12 }}>
          Something went wrong while reading Mitdo’s saved data on this device. Your data hasn’t been changed.
        </Text>
        <Text variant="small" tone="muted" align="center" style={{ marginBottom: 20 }}>
          {loadError}
        </Text>
        <Button title="Start fresh" kind="danger" onPress={() => actions.resetAll()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <NotificationBridge />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
        <Stack.Screen name="task/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="task/[id]" />
        <Stack.Screen name="categories" />
      </Stack>
    </View>
  );
}

/** Handles taps and action buttons (Mark done / Snooze) on reminders. */
function NotificationBridge() {
  const { actions } = useApp();
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);
  useEffect(
    () =>
      onNotificationAction((a) => {
        if (a.type === 'complete') actionsRef.current.setStatus(a.taskId, 'completed');
        else if (a.type === 'snooze') actionsRef.current.snooze(a.taskId);
        else if (a.taskId) router.push(`/task/${a.taskId}`);
      }),
    [],
  );
  return null;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
