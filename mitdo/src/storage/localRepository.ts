import AsyncStorage from '@react-native-async-storage/async-storage';
import { createEmptyData, DEFAULT_SETTINGS } from '@/models/defaults';
import type { AppData } from '@/models/types';
import type { DataRepository } from './repository';

const KEY = 'mitdo:data:v1';

/** Fill in anything missing from older or partial saves. */
export function normalizeData(raw: unknown): AppData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<AppData>;
  const base = createEmptyData();
  return {
    version: 1,
    tasks: Array.isArray(r.tasks) ? r.tasks.map((t) => ({ ...t, history: t.history ?? [], snoozedUntil: t.snoozedUntil ?? null })) : [],
    series: Array.isArray(r.series) ? r.series.map((s) => ({ ...s, skippedDates: s.skippedDates ?? [] })) : [],
    categories: Array.isArray(r.categories) && r.categories.length > 0 ? r.categories : base.categories,
    settings: { ...DEFAULT_SETTINGS, ...(r.settings ?? {}) },
  };
}

export const localRepository: DataRepository = {
  async load() {
    const json = await AsyncStorage.getItem(KEY);
    if (!json) return null;
    return normalizeData(JSON.parse(json));
  },
  async save(data) {
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  },
  async clear() {
    await AsyncStorage.removeItem(KEY);
  },
};
