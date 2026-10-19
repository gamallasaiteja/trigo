# Daily Check-in

A small app that runs your day in three steps:

1. **Morning.** At your start time it asks *"What do you want to do today?"* You answer
   in a chat, the way you'd text a friend (*"client report by 3pm, gym, call mom"*), and it
   sorts each task into an **impact × urgency matrix**:

   | | Urgent | Not urgent |
   |---|---|---|
   | **High impact** | Do now | Schedule |
   | **Low impact** | Quick / delegate | Later / drop |

   It tells you why it put each task where it did and what to start with. Tap any task to
   move or remove it. Unfinished tasks from last time are one tap away. Then press
   **Start my day**.
2. **During the day.** Every couple of hours it checks in. You tick off what's done,
   say whether you're on track, slow or stuck, and note anything you need. You can
   snooze a check-in for 30 minutes, check in early, or type new tasks into the chat as
   they come up; they land in the matrix too.
3. **Evening.** At your review time it asks how the day went. You mark each task
   **Done**, **Partly** or **Didn't**, choose which unfinished ones carry to tomorrow,
   write a line about the day and close it. You get a completion score (partly done
   counts as half).

The **History** tab shows your streak (days closed with at least one task done), your
average completion over the last 7 days, a 14-day chart and every past day.

## Run it

There's no build step. Serve this folder over HTTP and open it:

```bash
cd daily
python3 -m http.server 8000      # then open http://localhost:8000
```

To use it on your phone, host the folder anywhere static (GitHub Pages, Netlify,
Cloudflare Pages) and choose **Add to Home Screen** / **Install app**. It works offline.

## How sorting works

**On your device (default, free, offline).** Keyword rules look for urgency (*today,
asap, by 3pm, deadline, !*), calm (*someday, next week, no rush*), high impact (*client,
report, launch, exam, doctor, rent, family, important*) and low impact (*inbox, laundry,
errands, netflix, maybe*). A task with no impact signal goes to Schedule, since you
listed it for a reason. Add `#do`, `#plan`, `#quick` or `#later` to a task to place it
yourself.

**With Claude (optional).** Paste your own Anthropic API key in Settings and Claude reads
each message instead. It splits the message into tasks, sorts them with a short reason
and suggests where to start. The browser calls the Anthropic API directly, using the
official SDK loaded from jsDelivr. The key stays in this browser and is never included
in exports, but anyone using this browser profile could read it, so give it a low
spending limit. If Claude can't be reached, or the key is rejected, the chat says so and
sorts on the device.

## Settings

Morning prompt time (default 08:00), review time (default 21:00) and check-in
interval (default 2 hours). Turn on notifications in Settings or when you start your day.

## Good to know

- **Reminders need the app running.** Prompts fire while the app is open, including in
  a background tab or as an installed desktop app. Phones pause web apps that are fully
  closed, so there a missed prompt shows the moment you open the app. Reliable reminders
  on a closed phone app would need a push server.
- **Your data stays on the device** in the browser's local storage. Use **Export** in
  Settings to back it up or move it to another device. Clearing site data erases it.
- If you never close a day, it's closed for you the next morning and its unfinished
  tasks are offered for carry-over.

## Files

```
index.html, style.css   the screens
app.js                  storage, rendering, chat, the 30-second clock that fires prompts
logic.js                pure day logic: phases, check-in timing, scoring, streaks
classify.js             splitting chat messages into tasks + the on-device matrix sorter
ai.js                   optional Claude sorter (structured JSON output)
sw.js                   offline cache + tapping a notification opens the app
*.test.mjs              tests: node --test
```
