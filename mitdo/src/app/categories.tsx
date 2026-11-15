import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Pencil, Plus } from 'lucide-react-native';
import type { Category, CategoryColor } from '@/models/types';
import { CATEGORY_EMOJIS, FALLBACK_CATEGORY_ID } from '@/models/defaults';
import { useApp } from '@/store/AppStore';
import { CATEGORY_COLOR_KEYS, radius, useTheme } from '@/theme';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Text } from '@/components/Text';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ProgressBar } from '@/components/ProgressBar';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { categoryStats, pct } from '@/logic/analytics';

interface Form {
  id: string | null;
  name: string;
  emoji: string;
  color: CategoryColor;
}

export default function Categories() {
  const { data, today, actions } = useApp();
  const theme = useTheme();
  const { colors } = theme;
  const toast = useToast();
  const params = useLocalSearchParams<{ new?: string }>();
  const [form, setForm] = useState<Form | null>(() => (params.new ? { id: null, name: '', emoji: '🎯', color: 'green' } : null));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const due = useMemo(() => data.tasks.filter((t) => t.dueDate <= today), [data.tasks, today]);
  const stats = useMemo(() => categoryStats(due, data.categories), [due, data.categories]);
  const upcoming = (id: string) => data.tasks.filter((t) => t.categoryId === id && t.dueDate >= today && t.status !== 'completed').length;

  const open = (c: Category) => setForm({ id: c.id, name: c.name, emoji: c.emoji, color: c.color });
  const save = () => {
    if (!form) return;
    const name = form.name.trim();
    if (!name) return toast({ message: 'Give the category a name.' });
    if (data.categories.some((c) => c.id !== form.id && c.name.toLowerCase() === name.toLowerCase())) return toast({ message: 'You already have a category with that name.' });
    if (form.id) actions.updateCategory(form.id, { name, emoji: form.emoji, color: form.color });
    else actions.addCategory({ name, emoji: form.emoji, color: form.color });
    setForm(null);
  };

  const fallbackName = data.categories.find((c) => c.id === FALLBACK_CATEGORY_ID)?.name ?? 'another category';

  return (
    <Screen
      header={
        <Header
          title="Categories"
          right={
            <Pressable
              testID="add-category"
              onPress={() => setForm({ id: null, name: '', emoji: '🎯', color: 'green' })}
              accessibilityLabel="Add category"
              style={[styles.iconBtn, { backgroundColor: colors.primary }]}
            >
              <Plus size={20} color={colors.onPrimary} />
            </Pressable>
          }
        />
      }
    >
      <Text variant="small" tone="secondary" style={styles.lead}>
        Completion is based on tasks due up to today. Tap a category to see its tasks.
      </Text>
      <View style={styles.list}>
        {stats.map(({ category, counts, rate }) => {
          const cc = theme.category(category.color);
          const up = upcoming(category.id);
          return (
            <Card key={category.id} onPress={() => router.push(`/tasks?category=${category.id}`)} style={styles.row} accessibilityLabel={category.name}>
              <View style={[styles.emojiWrap, { backgroundColor: cc.bg }]}>
                <Text style={styles.emoji}>{category.emoji}</Text>
              </View>
              <View style={styles.flex}>
                <View style={styles.titleRow}>
                  <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                    {category.name}
                  </Text>
                  <Text variant="smallStrong" color={cc.fg}>
                    {counts.total ? `${pct(rate)}%` : '–'}
                  </Text>
                </View>
                <Text variant="caption" tone="secondary" style={styles.sub}>
                  {counts.completed}/{counts.total} completed · {up} upcoming
                </Text>
                <ProgressBar value={rate ?? 0} color={cc.fg} height={5} />
              </View>
              <Pressable onPress={() => open(category)} hitSlop={10} accessibilityLabel={`Edit ${category.name}`} style={styles.edit}>
                <Pencil size={16} color={colors.textSecondary} />
              </Pressable>
            </Card>
          );
        })}
      </View>

      <Sheet visible={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit category' : 'New category'}>
        {form ? (
          <>
            <View style={styles.preview}>
              <View style={[styles.emojiWrapLg, { backgroundColor: theme.category(form.color).bg }]}>
                <Text style={styles.emojiLg}>{form.emoji}</Text>
              </View>
              <TextInput
                testID="category-name"
                value={form.name}
                onChangeText={(name) => setForm({ ...form, name })}
                placeholder="Category name"
                placeholderTextColor={colors.textMuted}
                maxLength={30}
                autoFocus={!form.id}
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              />
            </View>
            <View style={styles.emojis}>
              {CATEGORY_EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => setForm({ ...form, emoji: e })}
                  style={[styles.emojiBtn, form.emoji === e && { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}
                  accessibilityLabel={`Icon ${e}`}
                >
                  <Text style={styles.emojiPick}>{e}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.colors}>
              {CATEGORY_COLOR_KEYS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setForm({ ...form, color: c })}
                  accessibilityLabel={`Colour ${c}`}
                  accessibilityState={{ selected: form.color === c }}
                  style={[styles.swatch, { backgroundColor: theme.category(c).fg }, form.color === c && { borderWidth: 3, borderColor: colors.text }]}
                />
              ))}
            </View>
            <Button testID="save-category" title={form.id ? 'Save' : 'Create category'} onPress={save} />
            {form.id && form.id !== FALLBACK_CATEGORY_ID ? (
              <Button title="Delete category" kind="ghost" onPress={() => setConfirmDelete(true)} />
            ) : null}
          </>
        ) : null}
      </Sheet>

      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete category?" message={`Its tasks won’t be deleted. They’ll move to “${fallbackName}”.`}>
        <Button
          title="Delete"
          kind="danger"
          onPress={() => {
            if (form?.id) actions.deleteCategory(form.id);
            setConfirmDelete(false);
            setForm(null);
          }}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  lead: { marginBottom: 14 },
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emojiWrap: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sub: { marginTop: 2, marginBottom: 8, fontWeight: '500' },
  edit: { padding: 6 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emojiWrapLg: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  emojiLg: { fontSize: 28 },
  input: { flex: 1, height: 50, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
  emojis: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  emojiBtn: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  emojiPick: { fontSize: 22 },
  colors: { flexDirection: 'row', gap: 10, marginVertical: 8, flexWrap: 'wrap' },
  swatch: { width: 32, height: 32, borderRadius: 16 },
});
