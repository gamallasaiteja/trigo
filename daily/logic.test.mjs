import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS as S, STATUS, newDay, makeTask, setStatus, phase, nextCheckinAt,
  isCheckinDue, isPlanDue, completion, closeDay, carryOverFrom, streak, previousKey,
} from "./logic.js";

const at = (hhmm) => new Date(`2026-10-17T${hhmm}:00`);

function plannedDay(hhmm = "09:00", titles = ["Write report", "Gym"]) {
  const day = newDay("2026-10-17");
  day.tasks = titles.map((t) => makeTask(t));
  day.plannedAt = at(hhmm).toISOString();
  return day;
}

test("phases move plan → active → review → closed", () => {
  const day = newDay("2026-10-17");
  assert.equal(phase(day, at("09:00"), S), "plan");
  day.plannedAt = at("09:00").toISOString();
  assert.equal(phase(day, at("12:00"), S), "active");
  assert.equal(phase(day, at("21:00"), S), "review");
  day.endRequested = true;
  assert.equal(phase(day, at("15:00"), S), "review");
  closeDay(day, at("21:30"));
  assert.equal(phase(day, at("21:31"), S), "closed");
});

test("morning prompt is due only after day start", () => {
  const day = newDay("2026-10-17");
  assert.equal(isPlanDue(day, at("07:59"), S), false);
  assert.equal(isPlanDue(day, at("08:00"), S), true);
});

test("check-ins follow the interval from the last check-in", () => {
  const day = plannedDay("09:00");
  assert.equal(nextCheckinAt(day, S).getTime(), at("11:00").getTime());
  assert.equal(isCheckinDue(day, at("10:59"), S), false);
  assert.equal(isCheckinDue(day, at("11:00"), S), true);
  day.checkins.push({ at: at("11:05").toISOString() });
  assert.equal(nextCheckinAt(day, S).getTime(), at("13:05").getTime());
});

test("snooze pushes the next check-in later", () => {
  const day = plannedDay("09:00");
  day.snoozeUntil = at("11:30").toISOString();
  assert.equal(isCheckinDue(day, at("11:10"), S), false);
  assert.equal(isCheckinDue(day, at("11:30"), S), true);
});

test("no check-in at or after the end of the day, or when nothing is open", () => {
  const late = plannedDay("19:30");
  assert.equal(nextCheckinAt(late, S), null);
  const day = plannedDay("09:00", ["One"]);
  setStatus(day.tasks[0], STATUS.DONE);
  assert.equal(isCheckinDue(day, at("12:00"), S), false);
});

test("completion counts partial as half and open as missed on close", () => {
  const day = plannedDay("09:00", ["a", "b", "c", "d"]);
  setStatus(day.tasks[0], STATUS.DONE);
  setStatus(day.tasks[1], STATUS.PARTIAL);
  const c = closeDay(day, at("21:00"));
  assert.deepEqual(c, { total: 4, done: 1, partial: 1, pct: 38 });
  assert.equal(day.tasks[2].status, STATUS.MISSED);
  assert.equal(completion(newDay("x")).pct, 0);
});

test("carry over keeps unfinished tasks the user didn't drop", () => {
  const day = plannedDay("09:00", ["a", "b", "c"]);
  setStatus(day.tasks[0], STATUS.DONE);
  day.tasks[2].carry = false;
  assert.deepEqual(carryOverFrom(day), ["b"]);
  assert.deepEqual(carryOverFrom(undefined), []);
});

test("streak counts back over closed days with something done", () => {
  const mk = (key, done) => {
    const d = newDay(key);
    d.tasks = [makeTask("x")];
    if (done) setStatus(d.tasks[0], STATUS.DONE);
    d.closedAt = "x";
    return d;
  };
  const days = {
    "2026-10-14": mk("2026-10-14", false),
    "2026-10-15": mk("2026-10-15", true),
    "2026-10-16": mk("2026-10-16", true),
    "2026-10-17": newDay("2026-10-17"),
  };
  assert.equal(streak(days, "2026-10-17"), 2);
  days["2026-10-17"] = mk("2026-10-17", true);
  assert.equal(streak(days, "2026-10-17"), 3);
});

test("previousKey crosses month and year boundaries", () => {
  assert.equal(previousKey("2026-03-01"), "2026-02-28");
  assert.equal(previousKey("2027-01-01"), "2026-12-31");
});
