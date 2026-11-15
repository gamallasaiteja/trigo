import { router } from 'expo-router';

/** Go back, or home if this screen was opened directly (deep link / notification). */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
