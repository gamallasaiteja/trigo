import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, useTheme } from '@/theme';
import { Text } from './Text';

interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

const ToastContext = createContext<(o: ToastOptions) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { key: number }) | null>(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();

  const hide = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setToast(null));
  }, [anim]);

  const show = useCallback(
    (o: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ ...o, key: Date.now() });
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
      timer.current = setTimeout(hide, o.duration ?? 3000);
    },
    [anim, hide],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            { bottom: insets.bottom + 96, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] },
          ]}
        >
          <View accessibilityLiveRegion="polite" style={[styles.toast, { backgroundColor: dark ? colors.cardAlt : '#202520' }]}>
            <Text variant="smallStrong" color="#FFFFFF" style={styles.msg}>
              {toast.message}
            </Text>
            {toast.actionLabel && toast.onAction ? (
              <Pressable
                hitSlop={10}
                onPress={() => {
                  toast.onAction?.();
                  hide();
                }}
                accessibilityRole="button"
              >
                <Text variant="smallStrong" color="#7DDA9F">
                  {toast.actionLabel}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: radius.lg,
    maxWidth: 520,
    width: '100%',
  },
  msg: { flex: 1 },
});
