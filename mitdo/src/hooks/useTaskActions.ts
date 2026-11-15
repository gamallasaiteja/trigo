import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/store/AppStore';
import { useToast } from '@/components/Toast';

const CHEERS = ['One more task completed. Keep moving!', 'Nice work! Done and dusted. ✓', 'Progress made. Keep it up!', 'That’s one less thing to think about. 🌱'];

/** One-tap completion with haptics, a friendly toast and undo. */
export function useToggleTask() {
  const { data, today, actions } = useApp();
  const toast = useToast();
  return useCallback(
    (id: string) => {
      const task = data.tasks.find((t) => t.id === id);
      if (!task) return;
      const completing = task.status !== 'completed';
      const prev = task.status;
      actions.toggleComplete(id);
      if (Platform.OS !== 'web') {
        (completing ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.selectionAsync()).catch(() => {});
      }
      if (completing) {
        const remaining = data.tasks.filter((t) => t.dueDate === today && t.status !== 'completed' && t.id !== id).length;
        const message =
          task.dueDate === today && remaining === 0
            ? 'Everything for today is done. 🎉 Well done!'
            : CHEERS[Math.floor(Math.random() * CHEERS.length)];
        toast({ message, actionLabel: 'Undo', onAction: () => actions.setStatus(id, prev) });
      }
    },
    [data.tasks, today, actions, toast],
  );
}
