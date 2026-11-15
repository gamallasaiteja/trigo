import React, { useEffect, useState } from 'react';
import { Linking, Share, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { AlarmClock, Bell, CalendarRange, Database, Download, FolderHeart, Info, Moon, Shield, Sparkles, Sun, Trash2 } from 'lucide-react-native';
import { useApp } from '@/store/AppStore';
import { radius, useTheme } from '@/theme';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Text } from '@/components/Text';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Button } from '@/components/Button';
import { SettingRow } from '@/components/SettingRow';
import { ChoiceSheet, Sheet } from '@/components/Sheet';
import { TimeStepper } from '@/components/TimeStepper';
import { useToast } from '@/components/Toast';
import { formatTime } from '@/logic/dates';
import { getPermission, notificationsSupported, requestPermission, type PermissionState } from '@/services/notifications';
import type { Settings, ThemePreference } from '@/models/types';

const REMINDER_DEFAULTS: { label: string; value: number | null }[] = [
  { label: 'No reminder', value: null },
  { label: 'At scheduled time', value: 0 },
  { label: '5 minutes before', value: 5 },
  { label: '15 minutes before', value: 15 },
  { label: '30 minutes before', value: 30 },
];
const reminderLabel = (v: number | null) => REMINDER_DEFAULTS.find((r) => r.value === v)?.label ?? `${v} minutes before`;

export default function Profile() {
  const { data, actions } = useApp();
  const { colors } = useTheme();
  const toast = useToast();
  const s = data.settings;
  const [perm, setPerm] = useState<PermissionState>('undetermined');
  const [editProfile, setEditProfile] = useState(false);
  const [summaryTimeOpen, setSummaryTimeOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [name, setName] = useState(s.userName);
  const [email, setEmail] = useState(s.email);
  const [summaryTime, setSummaryTime] = useState(s.dailySummaryTime);

  useEffect(() => {
    getPermission().then(setPerm).catch(() => {});
  }, []);

  const set = (patch: Partial<Settings>) => actions.updateSettings(patch);

  const toggleNotifications = async (on: boolean) => {
    if (!on) return set({ notificationsEnabled: false });
    const p = await requestPermission();
    setPerm(p);
    set({ notificationsEnabled: true });
    if (p === 'denied') toast({ message: 'Notifications are blocked. Allow them in Settings.', actionLabel: 'Open', onAction: () => Linking.openSettings() });
  };

  const exportData = async () => {
    const json = JSON.stringify(data, null, 2);
    try {
      await Share.share({ title: 'Mitdo data export', message: json });
    } catch {
      toast({ message: 'Sharing isn’t available here.' });
    }
  };

  const initials = (s.userName || 'You')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const permNote =
    !notificationsSupported
      ? 'Reminders work in the iOS and Android app. They aren’t available in the web preview.'
      : perm === 'denied'
        ? 'Notifications are blocked for Mitdo in system settings.'
        : null;

  return (
    <Screen header={<Header title="Profile" leading="none" />}>
      <Card style={styles.profile} onPress={() => setEditProfile(true)} accessibilityLabel="Edit profile">
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text variant="title" tone="inverse">
            {initials}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text variant="heading">{s.userName || 'Add your name'}</Text>
          <Text variant="small" tone="secondary">
            {s.email || 'Local profile · data stays on this device'}
          </Text>
        </View>
        <Text variant="smallStrong" tone="primary">
          Edit
        </Text>
      </Card>

      <Section title="Notifications">
        <SettingRow
          testID="toggle-notifications"
          icon={<Bell size={18} color={colors.primary} />}
          title="Reminders"
          subtitle={permNote ?? 'Get nudged when it’s time to act'}
          toggle={{ value: s.notificationsEnabled, onChange: toggleNotifications }}
        />
        {perm === 'denied' && notificationsSupported ? (
          <Button title="Open system settings" kind="secondary" small onPress={() => Linking.openSettings()} style={styles.inlineBtn} />
        ) : null}
        <SettingRow
          icon={<Sun size={18} color={colors.primary} />}
          title="Morning summary"
          subtitle="“You have 3 important things to accomplish today.”"
          toggle={{ value: s.dailySummaryEnabled, onChange: (v) => set({ dailySummaryEnabled: v }) }}
        />
        <SettingRow icon={<AlarmClock size={18} color={colors.primary} />} title="Summary time" value={formatTime(s.dailySummaryTime)} onPress={() => { setSummaryTime(s.dailySummaryTime); setSummaryTimeOpen(true); }} />
        <SettingRow icon={<Bell size={18} color={colors.primary} />} title="Default reminder" value={reminderLabel(s.defaultReminderMinutes)} onPress={() => setReminderOpen(true)} />
        <SettingRow icon={<AlarmClock size={18} color={colors.primary} />} title="Snooze length" value={`${s.snoozeMinutes} min`} onPress={() => setSnoozeOpen(true)} last />
      </Section>

      <Section title="Preferences">
        <View style={styles.prefRow}>
          <View style={[styles.prefIcon, { backgroundColor: colors.primarySoft }]}>
            <CalendarRange size={18} color={colors.primary} />
          </View>
          <Text variant="bodyStrong" style={styles.flex}>
            Week starts on
          </Text>
          <View style={styles.chips}>
            <Chip label="Mon" selected={s.weekStart === 1} onPress={() => set({ weekStart: 1 })} />
            <Chip label="Sun" selected={s.weekStart === 0} onPress={() => set({ weekStart: 0 })} />
          </View>
        </View>
        <View style={[styles.prefRow, styles.prefLast]}>
          <View style={[styles.prefIcon, { backgroundColor: colors.primarySoft }]}>
            <Moon size={18} color={colors.primary} />
          </View>
          <Text variant="bodyStrong" style={styles.flex}>
            Theme
          </Text>
          <View style={styles.chips}>
            {(['system', 'light', 'dark'] as ThemePreference[]).map((t) => (
              <Chip key={t} testID={`theme-${t}`} label={t[0].toUpperCase() + t.slice(1)} selected={s.theme === t} onPress={() => set({ theme: t })} />
            ))}
          </View>
        </View>
      </Section>

      <Section title="Organise">
        <SettingRow
          icon={<FolderHeart size={18} color={colors.primary} />}
          title="Categories"
          subtitle={`${data.categories.length} categories`}
          onPress={() => router.push('/categories')}
          last
        />
      </Section>

      <Section title="Data & privacy">
        <SettingRow
          icon={<Shield size={18} color={colors.primary} />}
          title="Stored on this device"
          subtitle="Mitdo works offline. Nothing is sent to a server, and there are no ads or tracking."
        />
        <SettingRow icon={<Download size={18} color={colors.primary} />} title="Export my data" subtitle="Share a JSON copy of everything" onPress={exportData} />
        <SettingRow
          testID="load-sample"
          icon={<Sparkles size={18} color={colors.primary} />}
          title="Load example tasks"
          subtitle="Explore Mitdo with ~4 weeks of example activity"
          onPress={() => setSampleOpen(true)}
        />
        <SettingRow icon={<Trash2 size={18} color={colors.danger} />} title="Delete all data" destructive onPress={() => setResetOpen(true)} last />
      </Section>

      <Section title="About">
        <SettingRow
          icon={<Info size={18} color={colors.primary} />}
          title="Mitdo"
          subtitle="Do what matters. Keep moving."
          value={`v${Constants.expoConfig?.version ?? '1.0.0'}`}
          last
        />
      </Section>

      {/* Sheets */}
      <Sheet visible={editProfile} onClose={() => setEditProfile(false)} title="Your profile">
        <Field label="Name">
          <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.textMuted} style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]} />
        </Field>
        <Field label="Email (optional)">
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          />
        </Field>
        <Text variant="caption" tone="secondary">
          Kept on this device only. Accounts and sync are planned for a later version.
        </Text>
        <Button
          title="Save"
          onPress={() => {
            const e = email.trim();
            if (e && !/^\S+@\S+\.\S+$/.test(e)) return toast({ message: 'That email doesn’t look right.' });
            set({ userName: name.trim(), email: e });
            setEditProfile(false);
          }}
          style={styles.sheetBtn}
        />
      </Sheet>

      <Sheet visible={summaryTimeOpen} onClose={() => setSummaryTimeOpen(false)} title="Morning summary time">
        <TimeStepper value={summaryTime} onChange={setSummaryTime} />
        <Button
          title="Save"
          onPress={() => {
            set({ dailySummaryTime: summaryTime });
            setSummaryTimeOpen(false);
          }}
          style={styles.sheetBtn}
        />
      </Sheet>

      <ChoiceSheet
        visible={reminderOpen}
        onClose={() => setReminderOpen(false)}
        title="Default reminder"
        message="Used for new tasks that have a time."
        options={REMINDER_DEFAULTS.map((r) => ({ label: `${r.value === s.defaultReminderMinutes ? '✓  ' : ''}${r.label}`, onPress: () => set({ defaultReminderMinutes: r.value }) }))}
      />
      <ChoiceSheet
        visible={snoozeOpen}
        onClose={() => setSnoozeOpen(false)}
        title="Snooze length"
        options={[5, 10, 15, 30].map((m) => ({ label: `${m === s.snoozeMinutes ? '✓  ' : ''}${m} minutes`, onPress: () => set({ snoozeMinutes: m }) }))}
      />
      <ChoiceSheet
        visible={sampleOpen}
        onClose={() => setSampleOpen(false)}
        title="Load example tasks?"
        message="Adds example recurring tasks with about four weeks of history so you can see progress and insights. Your own tasks are kept. You can delete everything later."
        options={[
          {
            label: 'Load examples',
            testID: 'confirm-sample',
            icon: <Database size={18} color={colors.primary} />,
            onPress: () => {
              actions.loadSampleData();
              toast({ message: 'Example tasks added' });
            },
          },
        ]}
      />
      <ChoiceSheet
        visible={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Delete all data?"
        message="All tasks, history, categories and settings will be removed from this device. This can’t be undone."
        options={[{ label: 'Delete everything', destructive: true, onPress: () => actions.resetAll() }]}
      />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="caption" tone="secondary" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </Text>
      <Card style={styles.sectionCard}>{children}</Card>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="smallStrong" tone="secondary">
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 24 },
  sectionTitle: { marginBottom: 8, marginLeft: 4, letterSpacing: 0.6 },
  sectionCard: { paddingVertical: 2 },
  inlineBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, flexWrap: 'wrap' },
  prefLast: {},
  prefIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: 6 },
  field: { gap: 6 },
  input: { height: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
  sheetBtn: { marginTop: 8 },
});
