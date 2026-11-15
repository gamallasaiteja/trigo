/**
 * Core data model for Mitdo.
 *
 * A `Task` is a single, dated thing to do. Recurring work is described by a
 * `TaskSeries` (the rule) which is materialised into separate dated `Task`
 * occurrences, so every day's completion history stays accurate even if the
 * rule changes later.
 */

/** Calendar date in local time, formatted `YYYY-MM-DD`. */
export type DateKey = string;
/** Local time of day, formatted `HH:mm` (24h). */
export type TimeKey = string;
/** ISO-8601 timestamp. */
export type Timestamp = string;

export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type Priority = 'none' | 'low' | 'medium' | 'high';
export type RepeatFrequency = 'none' | 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'custom';

export interface RepeatRule {
  frequency: RepeatFrequency;
  /** Weekdays (0 = Sunday … 6 = Saturday). Used by `custom`. */
  days?: number[];
}

export interface ReminderConfig {
  /** Minutes before the scheduled time. 0 = at the scheduled time. */
  offsetMinutes: number;
}

export type TaskEventType = 'created' | 'status_changed' | 'rescheduled' | 'edited' | 'snoozed';

export interface TaskEvent {
  type: TaskEventType;
  at: Timestamp;
  /** For status changes: previous status; for reschedules: previous date (+time). */
  from?: string;
  /** For status changes: new status; for reschedules: new date (+time). */
  to?: string;
}

export interface Task {
  id: string;
  /** Set when this task is an occurrence of a recurring series. */
  seriesId: string | null;
  title: string;
  description: string;
  categoryId: string;
  /** The date the task is currently due. Changes when rescheduled. */
  dueDate: DateKey;
  /** The date it was originally planned for (never changes). */
  originalDate: DateKey;
  scheduledTime: TimeKey | null;
  reminder: ReminderConfig | null;
  repeat: RepeatRule;
  priority: Priority;
  status: TaskStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  /** If the reminder was snoozed, when it should fire again. */
  snoozedUntil: Timestamp | null;
  history: TaskEvent[];
}

export interface TaskSeries {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  startDate: DateKey;
  /** Inclusive last date; null = repeats forever. */
  endDate: DateKey | null;
  scheduledTime: TimeKey | null;
  reminder: ReminderConfig | null;
  repeat: RepeatRule;
  priority: Priority;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Occurrences have been generated up to and including this date. */
  materializedThrough: DateKey | null;
  /** Dates whose occurrence the user deleted (never regenerate them). */
  skippedDates: DateKey[];
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  /** Accent colour key from the theme's category palette. */
  color: CategoryColor;
  isDefault: boolean;
  createdAt: Timestamp;
}

export type CategoryColor = 'green' | 'blue' | 'purple' | 'orange' | 'pink' | 'teal' | 'yellow' | 'red';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  userName: string;
  email: string;
  hasOnboarded: boolean;
  notificationsEnabled: boolean;
  dailySummaryEnabled: boolean;
  dailySummaryTime: TimeKey;
  /** Reminder applied to new timed tasks. null = no reminder by default. */
  defaultReminderMinutes: number | null;
  snoozeMinutes: number;
  /** 0 = Sunday, 1 = Monday. */
  weekStart: 0 | 1;
  theme: ThemePreference;
}

export interface AppData {
  version: 1;
  tasks: Task[];
  series: TaskSeries[];
  categories: Category[];
  settings: Settings;
}

/** Fields the user fills in when creating or editing a task. */
export interface TaskDraft {
  title: string;
  description: string;
  categoryId: string;
  dueDate: DateKey;
  scheduledTime: TimeKey | null;
  reminder: ReminderConfig | null;
  repeat: RepeatRule;
  priority: Priority;
}

/** Scope used when editing or deleting an occurrence of a recurring task. */
export type SeriesScope = 'this' | 'future';
