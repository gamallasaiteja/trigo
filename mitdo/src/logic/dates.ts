import type { DateKey, TimeKey } from '@/models/types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse a `YYYY-MM-DD` key into a local Date at midnight. */
export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function addMonths(key: DateKey, months: number): DateKey {
  const d = parseDateKey(key);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toDateKey(d);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: DateKey, b: DateKey): number {
  const ms = parseDateKey(b).getTime() - parseDateKey(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function weekday(key: DateKey): number {
  return parseDateKey(key).getDay();
}

export function isWeekend(key: DateKey): boolean {
  const d = weekday(key);
  return d === 0 || d === 6;
}

export function startOfWeek(key: DateKey, weekStart: 0 | 1): DateKey {
  const d = weekday(key);
  const back = (d - weekStart + 7) % 7;
  return addDays(key, -back);
}

export function startOfMonth(key: DateKey): DateKey {
  return key.slice(0, 8) + '01';
}

export function endOfMonth(key: DateKey): DateKey {
  const d = parseDateKey(startOfMonth(key));
  return toDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Inclusive list of date keys from `from` to `to`. */
export function dateRange(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

export function timeToMinutes(t: TimeKey): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): TimeKey {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** Combine a date key and a time key into a local Date. */
export function combine(date: DateKey, time: TimeKey): Date {
  const d = parseDateKey(date);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export function nowTimeKey(now: Date = new Date()): TimeKey {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export type DayPart = 'morning' | 'afternoon' | 'evening';

export function dayPart(time: TimeKey): DayPart {
  const h = Number(time.slice(0, 2));
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

// ---------- Formatting ----------

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_SHORT = WEEKDAYS.map((d) => d.slice(0, 3));

export function formatTime(t: TimeKey): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

export function formatMonthYear(key: DateKey): string {
  const d = parseDateKey(key);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** e.g. "Sunday, 15 November" */
export function formatLongDate(key: DateKey): string {
  const d = parseDateKey(key);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** e.g. "15 Nov" (adds year if different from the reference year). */
export function formatShortDate(key: DateKey, ref: DateKey = todayKey()): string {
  const d = parseDateKey(key);
  const base = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return key.slice(0, 4) === ref.slice(0, 4) ? base : `${base} ${d.getFullYear()}`;
}

/** Friendly relative label: Today, Tomorrow, Yesterday, Mon 16 Nov … */
export function formatRelativeDate(key: DateKey, ref: DateKey = todayKey()): string {
  const diff = diffDays(ref, key);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return `${WEEKDAYS_SHORT[weekday(key)]}, ${formatShortDate(key, ref)}`;
}

export function formatDateTime(iso: string, ref: DateKey = todayKey()): string {
  const d = new Date(iso);
  return `${formatRelativeDate(toDateKey(d), ref)}, ${formatTime(nowTimeKey(d))}`;
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Hello';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
