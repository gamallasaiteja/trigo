import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import type { AppData } from '@/models/types';
import { planNotifications } from './notificationPlan';

export const TASK_CATEGORY = 'mitdo-task';
export const ACTION_COMPLETE = 'complete';
export const ACTION_SNOOZE = 'snooze';

/** Local notifications are only available in native builds, not on web. */
export const notificationsSupported = Platform.OS === 'ios' || Platform.OS === 'android';

let configured = false;

export async function configureNotifications(snoozeMinutes: number): Promise<void> {
  if (!notificationsSupported) return;
  if (!configured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Task reminders',
        importance: AndroidImportance.HIGH,
        lightColor: '#218C52',
      });
    }
    configured = true;
  }
  await Notifications.setNotificationCategoryAsync(TASK_CATEGORY, [
    { identifier: ACTION_COMPLETE, buttonTitle: 'Mark as done ✓', options: { opensAppToForeground: false } },
    { identifier: ACTION_SNOOZE, buttonTitle: `Snooze ${snoozeMinutes} min`, options: { opensAppToForeground: false } },
  ]);
}

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function getPermission(): Promise<PermissionState> {
  if (!notificationsSupported) return 'unsupported';
  const res = await Notifications.getPermissionsAsync();
  if (res.granted) return 'granted';
  return res.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestPermission(): Promise<PermissionState> {
  if (!notificationsSupported) return 'unsupported';
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'denied';
  const res = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return res.granted ? 'granted' : 'denied';
}

let syncing: Promise<void> | null = null;
let pending: AppData | null = null;

/**
 * Replace all scheduled notifications with the current plan. Calls are
 * serialised; if data changes during a sync, one more sync runs afterwards.
 */
export function syncNotifications(data: AppData): Promise<void> {
  if (!notificationsSupported) return Promise.resolve();
  pending = data;
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      while (pending) {
        const next = pending;
        pending = null;
        const perm = await getPermission();
        await Notifications.cancelAllScheduledNotificationsAsync();
        if (perm !== 'granted') continue;
        for (const n of planNotifications(next)) {
          await Notifications.scheduleNotificationAsync({
            identifier: n.id,
            content: {
              title: n.title,
              body: n.body,
              data: n.data,
              sound: true,
              categoryIdentifier: n.data.kind === 'task' ? TASK_CATEGORY : undefined,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: n.date,
              channelId: Platform.OS === 'android' ? 'reminders' : undefined,
            },
          });
        }
      }
    } catch (e) {
      console.warn('[notifications] sync failed', e);
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

export type NotificationAction =
  | { type: 'complete'; taskId: string }
  | { type: 'snooze'; taskId: string }
  | { type: 'open'; taskId?: string };

/** Subscribe to taps and action buttons on Mitdo notifications. */
export function onNotificationAction(handler: (a: NotificationAction) => void): () => void {
  if (!notificationsSupported) return () => {};
  const handle = (res: Notifications.NotificationResponse) => {
    const data = res.notification.request.content.data as { taskId?: string } | undefined;
    const taskId = data?.taskId;
    if (res.actionIdentifier === ACTION_COMPLETE && taskId) handler({ type: 'complete', taskId });
    else if (res.actionIdentifier === ACTION_SNOOZE && taskId) handler({ type: 'snooze', taskId });
    else handler({ type: 'open', taskId });
  };
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  const last = Notifications.getLastNotificationResponse();
  if (last) {
    handle(last);
    Notifications.clearLastNotificationResponse();
  }
  return () => sub.remove();
}
