# Daily Check-in

A small app that runs your day in three steps:

1. **Morning.** At your start time it asks *"What do you want to do today?"* You list
   your tasks, with one-tap re-adds for anything left unfinished last time, and press
   **Start my day**.
2. **During the day.** Every couple of hours it checks in. You tick off what's done,
   say whether you're on track, slow or stuck, and note anything you need. You can
   snooze a check-in for 30 minutes, check in early, or add tasks as they come up.
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
app.js                  storage, rendering, the 30-second clock that fires prompts
logic.js                pure day logic: phases, check-in timing, scoring, streaks
sw.js                   offline cache + tapping a notification opens the app
logic.test.mjs          tests: node --test
```
