// Pure day-tracking logic: no DOM, no storage, so it can be tested in Node.

export const DEFAULT_SETTINGS = {
  dayStart: "08:00",     // when the morning "what do you want to do?" prompt fires
  dayEnd: "21:00",       // when the end-of-day review is due
  checkinMinutes: 120,   // gap between check-ins during the day
  snoozeMinutes: 30,
};

export const STATUS = { OPEN: "open", DONE: "done", PARTIAL: "partial", MISSED: "missed" };

export function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function previousKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}

// "HH:MM" on the same calendar day as `ref`.
export function atTime(ref, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(ref);
  d.setHours(h, m, 0, 0);
  return d;
}

export function newDay(key) {
  return {
    date: key,
    tasks: [],
    plannedAt: null,
    checkins: [],
    snoozeUntil: null,
    endRequested: false,
    closedAt: null,
    reflection: "",
    notified: {},
  };
}

let counter = 0;
export function makeTask(title, carriedFrom = null) {
  counter += 1;
  return {
    id: `${Date.now().toString(36)}-${counter}`,
    title: title.trim(),
    status: STATUS.OPEN,
    doneAt: null,
    carriedFrom,
    carry: true,
  };
}

export function setStatus(task, status, now = new Date()) {
  task.status = status;
  task.doneAt = status === STATUS.DONE ? now.toISOString() : null;
}

// plan → active → review → closed
export function phase(day, now, settings) {
  if (day.closedAt) return "closed";
  if (!day.plannedAt) return "plan";
  if (day.endRequested || now >= atTime(now, settings.dayEnd)) return "review";
  return "active";
}

// Next check-in counts from the last check-in (or from when the day was planned).
// Returns null when the next slot would fall at or after the end of the day.
export function nextCheckinAt(day, settings) {
  if (!day.plannedAt || day.closedAt) return null;
  const last = day.checkins.length ? day.checkins[day.checkins.length - 1].at : day.plannedAt;
  let next = new Date(new Date(last).getTime() + settings.checkinMinutes * 60000);
  if (day.snoozeUntil && new Date(day.snoozeUntil) > next) next = new Date(day.snoozeUntil);
  const end = atTime(new Date(day.plannedAt), settings.dayEnd);
  return next < end ? next : null;
}

export function isCheckinDue(day, now, settings) {
  if (phase(day, now, settings) !== "active") return false;
  if (!day.tasks.some((t) => t.status === STATUS.OPEN)) return false;
  const next = nextCheckinAt(day, settings);
  return next !== null && now >= next;
}

export function isPlanDue(day, now, settings) {
  return phase(day, now, settings) === "plan" && now >= atTime(now, settings.dayStart);
}

// A partly-done task counts as half.
export function completion(day) {
  const total = day.tasks.length;
  const done = day.tasks.filter((t) => t.status === STATUS.DONE).length;
  const partial = day.tasks.filter((t) => t.status === STATUS.PARTIAL).length;
  const pct = total ? Math.round(((done + partial / 2) / total) * 100) : 0;
  return { total, done, partial, pct };
}

// Closing the day: anything still open counts as missed.
export function closeDay(day, now = new Date()) {
  for (const t of day.tasks) if (t.status === STATUS.OPEN) t.status = STATUS.MISSED;
  day.closedAt = now.toISOString();
  return completion(day);
}

// Unfinished tasks from a previous day the user chose to carry forward.
export function carryOverFrom(prev) {
  if (!prev) return [];
  return prev.tasks
    .filter((t) => t.status !== STATUS.DONE && t.carry !== false)
    .map((t) => t.title);
}

// Consecutive closed days with at least one task done, counting back from
// today (or from yesterday if today isn't closed yet).
export function streak(days, todayKey) {
  let key = todayKey;
  const today = days[key];
  if (!today || !today.closedAt) key = previousKey(key);
  let n = 0;
  for (;;) {
    const d = days[key];
    if (!d || !d.closedAt || completion(d).done === 0) return n;
    n += 1;
    key = previousKey(key);
  }
}
