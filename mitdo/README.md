# Mitdo

**Do what matters. Keep moving.**

Mitdo is a personal execution and accountability app. You add the few things
that matter, it reminds you when to do them, records whether you followed
through, and shows how consistent you are.

Built with Expo SDK 58, React Native, TypeScript and Expo Router. Local-first:
everything works offline and is stored on the device.

## Run it

```bash
cd mitdo
npm install
npx expo start          # scan the QR code with Expo Go, or press i / a / w
```

- **Reminders need a phone or simulator.** Local notifications don't exist on
  web, so the web preview hides them. In **Expo Go on Android**, local
  notifications work but may show limitations warnings; for full behaviour
  (action buttons, sounds) use a development build:
  `npx expo run:ios` / `npx expo run:android`, or `eas build --profile development`.
- First launch asks only for a name. To explore with data, go to
  **Profile → Load example tasks** (about 4 weeks of example activity, clearly
  opt-in; **Delete all data** removes it).

```bash
npm test                # 23 unit tests: recurrence, task ops, analytics, insights, notification plan
npm run typecheck
```

## What's in the MVP

| Area | What works |
|---|---|
| Home | Greeting, date, daily progress (%, completed / in progress / to do), overdue banner, category cards with today's progress, today's tasks in time order with one-tap completion (+ undo), reminders sheet |
| Tasks | All / To Do / In Progress / Done filters, week strip to browse any day, overdue view, grouped and collapsible by category, long-press menu (status, move to tomorrow, edit) |
| Add / edit | Title is the only required field. Category, date, time, reminder (at time / 5 / 15 / 30 / custom), repeat (none / daily / weekdays / weekends / weekly / custom days), priority, note |
| Task details | Status control, reschedule (keeps history), snooze, edit, delete, full history timeline |
| Recurring tasks | Stored as a rule (`TaskSeries`) and materialised into separate dated tasks 14 days ahead. Edit or delete "this one" or "this and future" (splits the series; completed history is never rewritten) |
| Progress | Month calendar with per-day state, month completion, breakdown, overall / week / month rates, total completed, streak, most consistent category, last-7-days chart, per-category bars, rule-based insights |
| Notifications | Per-task reminders, morning summary, "Mark as done" and "Snooze" action buttons, permission handling, resync on every change |
| Profile | Name / email, notification settings, default reminder, snooze length, week start, theme (system / light / dark), categories (add / edit / delete), export JSON, delete all data |

### Rules worth knowing

- **Overdue vs missed.** A one-off task whose date passed stays *overdue* and
  keeps showing until you complete or reschedule it. A past occurrence of a
  recurring task that wasn't done is *missed*: it stays on its day and counts
  as not done, but doesn't pile up, because the next occurrence replaces it.
  Nothing is ever silently removed or marked done.
- **Rates only count tasks due up to today.** Future plans never count as misses.
- **Insights are rule-based and only appear with enough data** (thresholds in
  `src/logic/insights.ts` → `INSIGHT_RULES`). Comparisons use finished days
  only, so today's open tasks don't drag them down.
- **Notification budget.** iOS allows 64 pending local notifications; Mitdo
  schedules the next 7 days, capped at 60, and reschedules whenever data
  changes or the app opens.

## Architecture

```
src/
  app/            Expo Router screens: (tabs)/index, tasks, add, progress, profile;
                  task/new (add + edit), task/[id], categories, welcome
  components/     Design-system UI: Card, Chip, Button, TaskRow, StatusIcon, Sheet,
                  Toast, MiniCalendar, TimeStepper, TabBar, illustrations…
  theme/          Tokens (colours light/dark, spacing, radius, type) + ThemeProvider
  models/         Data types and defaults
  logic/          Pure business logic: dates, recurrence, taskOps, analytics,
                  insights, sampleData (no React, fully unit-tested)
  services/       notificationPlan (pure) + notifications (expo-notifications)
  storage/        DataRepository interface + AsyncStorage implementation
  store/          AppStore: state, persistence, day rollover, notification sync
  hooks/          useToggleTask (completion + haptics + toast + undo)
  __tests__/      Jest tests
supabase/schema.sql   Proposed tables + RLS for cloud sync (not wired up)
```

All state changes go through pure functions in `src/logic/taskOps.ts`, so the
UI, storage and notifications never disagree about what happened.

## Not done yet (honest limitations)

- **No Supabase auth or cloud sync.** No credentials were available, so the app
  is local-first. Adding sync means implementing `DataRepository` (see
  `src/storage/repository.ts`) against `supabase/schema.sql`. Email in Profile is
  stored locally only.
- **Notifications were not tested on a physical device in this build
  environment.** The scheduling plan is unit-tested and the iOS/Android bundles
  compile, but delivery, action buttons and permission prompts need a check on a
  real phone / development build.
- Data is one JSON document in AsyncStorage: fine for years of personal use,
  but a move to SQLite would make sense before syncing large histories.
- Export uses the system share sheet with JSON text; there is no import yet.
