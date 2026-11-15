import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/store/AppStore';
import { radius, useTheme } from '@/theme';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { MountainIllustration } from '@/components/Illustrations';

/** One-step welcome: just a name (optional). */
export default function Welcome() {
  const { actions } = useApp();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const finish = () => {
    actions.updateSettings({ userName: name.trim(), hasOnboarded: true });
    router.replace('/');
  };
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        <View style={styles.hero}>
          <View style={[styles.art, { backgroundColor: colors.primarySoft }]}>
            <MountainIllustration width={220} height={160} />
          </View>
          <Text variant="display" align="center" style={styles.brand}>
            Mitdo
          </Text>
          <Text variant="subheading" tone="primary" align="center">
            Do what matters. Keep moving.
          </Text>
          <Text tone="secondary" align="center" style={styles.lead}>
            Decide what matters, get reminded at the right time, and see how consistently you follow through.
          </Text>
        </View>
        <View style={styles.form}>
          <Text variant="smallStrong" tone="secondary">
            What should we call you?
          </Text>
          <TextInput
            testID="welcome-name"
            value={name}
            onChangeText={setName}
            placeholder="Your first name"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            onSubmitEditing={finish}
            autoCapitalize="words"
            style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          />
          <Button testID="welcome-start" title="Get started" onPress={finish} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, padding: 24, justifyContent: 'space-between', maxWidth: 520, width: '100%', alignSelf: 'center' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  art: { borderRadius: 32, padding: 20, marginBottom: 28 },
  brand: { fontSize: 36, marginBottom: 6 },
  lead: { marginTop: 14, maxWidth: 320, lineHeight: 22 },
  form: { gap: 12, paddingBottom: 12 },
  input: { height: 52, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
});
