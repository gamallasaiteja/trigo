import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, useTheme } from '@/theme';
import { Text } from './Text';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  children?: React.ReactNode;
}

/** Bottom sheet built on Modal; works on iOS, Android and web. */
export function Sheet({ visible, onClose, title, message, children }: SheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          {title ? (
            <Text variant="heading" align="center">
              {title}
            </Text>
          ) : null}
          {message ? (
            <Text variant="small" tone="secondary" align="center" style={styles.message}>
              {message}
            </Text>
          ) : null}
          <View style={styles.content}>{children}</View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export interface SheetOption {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  icon?: React.ReactNode;
  testID?: string;
}

/** A list of choices (replacement for multi-button alerts, which don't work on web). */
export function ChoiceSheet({ visible, onClose, title, message, options }: SheetProps & { options: SheetOption[] }) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title} message={message}>
      {options.map((o) => (
        <Pressable
          key={o.label}
          testID={o.testID}
          onPress={() => {
            onClose();
            o.onPress();
          }}
          style={({ pressed }) => [styles.option, { backgroundColor: pressed ? colors.cardAlt : colors.background }]}
          accessibilityRole="button"
        >
          {o.icon}
          <Text variant="bodyStrong" color={o.destructive ? colors.danger : colors.text}>
            {o.label}
          </Text>
        </Pressable>
      ))}
      <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
        <Text variant="bodyStrong" tone="secondary">
          Cancel
        </Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: 20,
    paddingTop: 10,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  message: { marginTop: 6 },
  content: { marginTop: 16, gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 54, borderRadius: radius.lg, paddingHorizontal: 16 },
  cancel: { height: 50, alignItems: 'center', justifyContent: 'center' },
});
