import type { AppData, Category, Settings } from './types';

const EPOCH = '2024-01-01T00:00:00.000Z';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_home', name: 'Home', emoji: '🏠', color: 'green', isDefault: true, createdAt: EPOCH },
  { id: 'cat_work', name: 'Work / School', emoji: '💼', color: 'blue', isDefault: true, createdAt: EPOCH },
  { id: 'cat_health', name: 'Health & Fitness', emoji: '💪', color: 'orange', isDefault: true, createdAt: EPOCH },
  { id: 'cat_learning', name: 'Learning', emoji: '📚', color: 'teal', isDefault: true, createdAt: EPOCH },
  { id: 'cat_personal', name: 'Personal', emoji: '🌱', color: 'pink', isDefault: true, createdAt: EPOCH },
  { id: 'cat_worship', name: 'Worship / Spirituality', emoji: '🕌', color: 'purple', isDefault: true, createdAt: EPOCH },
];

/** Category that tasks fall back to when their category is deleted. */
export const FALLBACK_CATEGORY_ID = 'cat_personal';

export const DEFAULT_SETTINGS: Settings = {
  userName: '',
  email: '',
  hasOnboarded: false,
  notificationsEnabled: true,
  dailySummaryEnabled: true,
  dailySummaryTime: '08:00',
  defaultReminderMinutes: 0,
  snoozeMinutes: 10,
  weekStart: 1,
  theme: 'system',
};

export function createEmptyData(): AppData {
  return {
    version: 1,
    tasks: [],
    series: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    settings: { ...DEFAULT_SETTINGS },
  };
}

export const CATEGORY_EMOJIS = [
  '🏠', '💼', '💪', '📚', '🌱', '🕌', '🧘', '🎨', '🎵', '🛒', '💰', '✈️',
  '🍳', '🐶', '👨‍👩‍👧', '❤️', '🧹', '💻', '📝', '⚽', '🌙', '☕', '🎯', '🙏',
];
