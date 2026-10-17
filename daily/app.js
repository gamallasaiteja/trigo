import {
  DEFAULT_SETTINGS, STATUS, dateKey, atTime, newDay, makeTask, setStatus, phase,
  nextCheckinAt, isCheckinDue, isPlanDue, completion, closeDay, carryOverFrom, streak,
} from "./logic.js";

const STORE_KEY = "daily-checkin-v1";
const $ = (id) => document.getElementById(id);

// ---------- storage ----------

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return { settings: { ...DEFAULT_SETTINGS, ...data.settings }, days: data.days || {} };
    }
  } catch { /* private mode or corrupt data: start fresh */ }
  return { settings: { ...DEFAULT_SETTINGS }, days: {} };
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

const state = load();

function today() {
  const key = dateKey(new Date());
  if (!state.days[key]) state.days[key] = newDay(key);
  return state.days[key];
}

// A planned day that was never reviewed gets closed when a new day starts,
// so its unfinished tasks are offered as carry-overs.
function closeStaleDays() {
  const key = dateKey(new Date());
  for (const d of Object.values(state.days)) {
    if (d.date < key && d.plannedAt && !d.closedAt) {
      closeDay(d, atTime(new Date(d.plannedAt), state.settings.dayEnd));
      d.autoClosed = true;
    }
  }
}

function lastDayBefore(key) {
  const keys = Object.keys(state.days).filter((k) => k < key && state.days[k].plannedAt).sort();
  return keys.length ? state.days[keys[keys.length - 1]] : null;
}

// ---------- small DOM helpers ----------

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, "");
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const fmtDate = (key, opts = { weekday: "short", day: "numeric", month: "short" }) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], opts);
};

// ---------- notifications ----------

async function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) reg.showNotification(title, { body, icon: "icon.svg", tag: "daily-checkin" });
    else new Notification(title, { body, icon: "icon.svg" });
  } catch { /* notifications are best-effort */ }
}

function renderNotifStatus() {
  const s = $("notif-status");
  const btn = $("notif-enable");
  if (!("Notification" in window)) {
    s.textContent = "This browser doesn't support notifications. Prompts still appear in the app.";
    btn.hidden = true;
  } else if (Notification.permission === "granted") {
    s.textContent = "Notifications are on.";
    btn.hidden = true;
  } else if (Notification.permission === "denied") {
    s.textContent = "Notifications are blocked. Allow them in your browser's site settings.";
    btn.hidden = true;
  } else {
    s.textContent = "Notifications are off.";
    btn.hidden = false;
  }
}

async function askNotifications() {
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }
  renderNotifStatus();
}

// ---------- rendering ----------

let tab = "today";

function render() {
  const day = today();
  const now = new Date();
  const ph = phase(day, now, state.settings);
  $("today-label").textContent = fmtDate(day.date, { weekday: "long", day: "numeric", month: "long" });
  $("phase-label").textContent = {
    plan: "Morning: plan your day",
    active: "During the day: keep going",
    review: "Evening: review your day",
    closed: "Day closed",
  }[ph];

  for (const p of ["plan", "active", "review", "closed"]) $(`panel-${p}`).hidden = p !== ph;
  if (ph === "plan") renderPlan(day);
  if (ph === "active") renderActive(day);
  if (ph === "review") renderReview(day);
  if (ph === "closed") renderClosed(day);
  if (tab === "history") renderHistory();
}

function taskRow(day, t, { removable = false, checkable = true } = {}) {
  const done = t.status === STATUS.DONE;
  return el("li", { class: done ? "is-done" : "" },
    checkable ? el("input", {
      type: "checkbox", checked: done, "aria-label": `Done: ${t.title}`,
      onchange: (e) => { setStatus(t, e.target.checked ? STATUS.DONE : STATUS.OPEN); save(); render(); },
    }) : null,
    el("span", { class: "title" }, t.title),
    t.carriedFrom ? el("span", { class: "tag" }, "carried") : null,
    removable ? el("button", {
      class: "icon-btn", type: "button", "aria-label": `Remove ${t.title}`,
      onclick: () => { day.tasks = day.tasks.filter((x) => x !== t); save(); render(); },
    }, "×") : null,
  );
}

function renderPlan(day) {
  $("plan-list").replaceChildren(...day.tasks.map((t) => taskRow(day, t, { removable: true, checkable: false })));
  $("start-day").disabled = day.tasks.length === 0;

  const prev = lastDayBefore(day.date);
  const have = new Set(day.tasks.map((t) => t.title.toLowerCase()));
  const carry = carryOverFrom(prev).filter((title) => !have.has(title.toLowerCase()));
  $("carry-box").hidden = carry.length === 0;
  $("carry-list").replaceChildren(...carry.map((title) => el("button", {
    class: "chip", type: "button",
    onclick: () => { day.tasks.push(makeTask(title, prev.date)); save(); render(); },
  }, `+ ${title}`)));
}

function renderActive(day) {
  const c = completion(day);
  $("active-pct").textContent = `${c.done}/${c.total} done`;
  $("active-bar").style.width = `${c.total ? (c.done / c.total) * 100 : 0}%`;
  $("active-list").replaceChildren(...day.tasks.map((t) => taskRow(day, t, { removable: t.status === STATUS.OPEN })));

  const next = nextCheckinAt(day, state.settings);
  const allDone = c.total > 0 && c.done === c.total;
  $("next-checkin").textContent = allDone
    ? `Everything's done. Your review is at ${fmtTime(atTime(new Date(), state.settings.dayEnd))}.`
    : next
      ? `Next check-in around ${fmtTime(next)}. Review at ${fmtTime(atTime(new Date(), state.settings.dayEnd))}.`
      : `No more check-ins today. Review at ${fmtTime(atTime(new Date(), state.settings.dayEnd))}.`;

  $("checkin-log-box").hidden = day.checkins.length === 0;
  const moodText = { "on-track": "On track", slow: "Slow", stuck: "Stuck" };
  $("checkin-log").replaceChildren(...day.checkins.slice().reverse().map((ci) => el("li", {},
    el("span", { class: "when" }, fmtTime(ci.at)),
    `${moodText[ci.mood] || ""}${ci.done?.length ? ` · finished ${ci.done.length}` : ""}`,
    ci.note ? el("div", { class: "muted" }, ci.note) : null,
  )));
}

function renderReview(day) {
  const labels = { [STATUS.DONE]: "Done", [STATUS.PARTIAL]: "Partly", [STATUS.MISSED]: "Didn't" };
  $("review-list").replaceChildren(...day.tasks.map((t) => {
    const seg = el("div", { class: "seg", role: "group", "aria-label": t.title },
      ...Object.entries(labels).map(([s, label]) => el("button", {
        type: "button", "data-s": s, "aria-pressed": String(t.status === s),
        onclick: () => { setStatus(t, t.status === s ? STATUS.OPEN : s); save(); render(); },
      }, label)));
    const carry = t.status !== STATUS.DONE ? el("label", { class: "carry" },
      el("input", { type: "checkbox", checked: t.carry !== false,
        onchange: (e) => { t.carry = e.target.checked; save(); } }),
      "Carry to tomorrow") : null;
    return el("li", {}, el("span", { class: "title" }, t.title), seg, carry);
  }));
  if (document.activeElement !== $("reflection")) $("reflection").value = day.reflection || "";
}

function renderClosed(day) {
  const c = completion(day);
  $("closed-pct").textContent = `${c.pct}%`;
  $("closed-detail").textContent =
    `${c.done} done${c.partial ? `, ${c.partial} partly` : ""} of ${c.total}` +
    ` · ${streak(state.days, day.date)} day streak`;
  const cls = { done: "st-done", partial: "st-partial", missed: "st-missed" };
  const mark = { done: "✓", partial: "◐", missed: "✗" };
  $("closed-list").replaceChildren(...day.tasks.map((t) => el("li", {},
    el("span", { class: cls[t.status] }, mark[t.status] || "·"),
    el("span", { class: "title" }, t.title))));
  $("closed-reflection").hidden = !day.reflection;
  $("closed-reflection").textContent = day.reflection || "";
  $("closed-start").textContent = fmtTime(atTime(new Date(), state.settings.dayStart));
}

function renderHistory() {
  const todayKey = dateKey(new Date());
  const closed = Object.values(state.days).filter((d) => d.closedAt).sort((a, b) => b.date.localeCompare(a.date));

  $("stat-streak").textContent = streak(state.days, todayKey);
  $("stat-days").textContent = closed.length;
  const week = [];
  for (let i = 0; i < 7; i++) {
    const d = state.days[dateKey(new Date(Date.now() - i * 86400000))];
    if (d?.closedAt) week.push(completion(d).pct);
  }
  $("stat-avg").textContent = week.length ? `${Math.round(week.reduce((a, b) => a + b, 0) / week.length)}%` : "–";

  const cols = [];
  for (let i = 13; i >= 0; i--) {
    const now = new Date();
    const key = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
    const d = state.days[key];
    const pct = d?.closedAt ? completion(d).pct : null;
    cols.push(el("div", { class: "col", title: `${fmtDate(key)}: ${pct == null ? "not tracked" : pct + "%"}` },
      el("div", { class: `colbar${pct == null ? " empty" : ""}`, style: `height:${pct ?? 0}%` }),
      el("span", { class: "lbl" }, fmtDate(key, { day: "numeric" }))));
  }
  $("chart").replaceChildren(...cols);

  $("history-empty").hidden = closed.length > 0;
  $("history-list").replaceChildren(...closed.map((d) => {
    const c = completion(d);
    const detail = el("div", { class: "detail", hidden: true },
      d.tasks.map((t) => `${{ done: "✓", partial: "◐", missed: "✗" }[t.status] || "·"} ${t.title}`).join("   "),
      d.reflection ? el("div", { class: "quote" }, d.reflection) : null);
    return el("li", { onclick: () => { detail.hidden = !detail.hidden; } },
      el("span", { class: "d" }, fmtDate(d.date)),
      el("div", { class: "bar" }, el("div", { class: "bar-fill", style: `width:${c.pct}%` })),
      el("span", { class: "p" }, `${c.pct}%`),
      detail);
  }));
}

// ---------- check-in dialog ----------

let pending = new Set();

function openCheckin() {
  const day = today();
  const dlg = $("checkin-dialog");
  if (dlg.open) return;
  pending = new Set();
  $("checkin-title").textContent = `Check-in · ${fmtTime(new Date())}`;
  const open = day.tasks.filter((t) => t.status === STATUS.OPEN);
  $("checkin-tasks").replaceChildren(...open.map((t) => el("li", {},
    el("input", { type: "checkbox", id: `ci-${t.id}`,
      onchange: (e) => { e.target.checked ? pending.add(t.id) : pending.delete(t.id); } }),
    el("label", { class: "title", for: `ci-${t.id}` }, t.title))));
  $("checkin-form").reset();
  dlg.showModal();
}

function saveCheckin() {
  const day = today();
  const form = $("checkin-form");
  const now = new Date();
  for (const t of day.tasks) if (pending.has(t.id)) setStatus(t, STATUS.DONE, now);
  day.checkins.push({
    at: now.toISOString(),
    mood: form.mood.value,
    note: form.note.value.trim(),
    done: [...pending],
  });
  day.snoozeUntil = null;
  save();
  render();
}

function snooze() {
  const day = today();
  day.snoozeUntil = new Date(Date.now() + state.settings.snoozeMinutes * 60000).toISOString();
  save();
  $("checkin-dialog").close("snooze");
  render();
}

// ---------- the clock: runs every 30 s and fires each prompt once ----------

let lastKey = dateKey(new Date());

function tick() {
  const key = dateKey(new Date());
  if (key !== lastKey) { lastKey = key; closeStaleDays(); save(); }
  const day = today();
  const now = new Date();
  const s = state.settings;
  const ph = phase(day, now, s);

  if (isPlanDue(day, now, s) && !day.notified.plan) {
    day.notified.plan = true;
    notify("Good morning", "What do you want to do today?");
  }

  if (isCheckinDue(day, now, s)) {
    const slot = nextCheckinAt(day, s).toISOString();
    if (day.notified.checkin !== slot) {
      day.notified.checkin = slot;
      const open = day.tasks.filter((t) => t.status === STATUS.OPEN).length;
      notify("Check-in", `How's it going? ${open} task${open === 1 ? "" : "s"} still open.`);
      if (tab !== "today") switchTab("today");
      openCheckin();
    }
  }

  if (ph === "review" && !day.endRequested && !day.notified.review) {
    day.notified.review = true;
    const c = completion(day);
    notify("Time to review your day", `${c.done} of ${c.total} done. How did it go?`);
  }

  save();
  render();
}

// ---------- wiring ----------

function switchTab(name) {
  tab = name;
  for (const b of document.querySelectorAll(".tab")) b.classList.toggle("active", b.dataset.tab === name);
  for (const p of document.querySelectorAll(".tab-panel")) p.hidden = p.id !== `tab-${name}`;
  if (name === "settings") fillSettings();
  render();
}

function addFrom(input) {
  const title = input.value.trim();
  if (!title) return;
  today().tasks.push(makeTask(title));
  input.value = "";
  save();
  render();
  input.focus();
}

function fillSettings() {
  const f = $("settings-form");
  f.dayStart.value = state.settings.dayStart;
  f.dayEnd.value = state.settings.dayEnd;
  f.checkinMinutes.value = String(state.settings.checkinMinutes);
  renderNotifStatus();
}

for (const b of document.querySelectorAll(".tab")) b.addEventListener("click", () => switchTab(b.dataset.tab));

$("plan-form").addEventListener("submit", (e) => { e.preventDefault(); addFrom($("plan-input")); });
$("active-form").addEventListener("submit", (e) => { e.preventDefault(); addFrom($("active-input")); });

$("start-day").addEventListener("click", () => {
  const day = today();
  day.plannedAt = new Date().toISOString();
  save();
  askNotifications();
  render();
});

$("checkin-now").addEventListener("click", openCheckin);
$("end-now").addEventListener("click", () => { today().endRequested = true; save(); render(); });

$("checkin-form").addEventListener("submit", () => saveCheckin());
$("checkin-snooze").addEventListener("click", snooze);
$("checkin-dialog").addEventListener("cancel", (e) => { e.preventDefault(); snooze(); });

$("reflection").addEventListener("input", (e) => { today().reflection = e.target.value; save(); });
$("close-day").addEventListener("click", () => {
  const day = today();
  day.reflection = $("reflection").value.trim();
  closeDay(day);
  save();
  render();
});
$("reopen-day").addEventListener("click", () => {
  const day = today();
  day.closedAt = null;
  day.endRequested = true;
  for (const t of day.tasks) if (t.status === STATUS.MISSED) t.status = STATUS.OPEN;
  save();
  render();
});

$("settings-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.dayEnd.value <= f.dayStart.value) {
    alert("The review time needs to be after the morning prompt.");
    return;
  }
  state.settings.dayStart = f.dayStart.value;
  state.settings.dayEnd = f.dayEnd.value;
  state.settings.checkinMinutes = Number(f.checkinMinutes.value);
  save();
  $("settings-saved").hidden = false;
  setTimeout(() => { $("settings-saved").hidden = true; }, 1500);
  render();
});
$("notif-enable").addEventListener("click", askNotifications);

$("export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `daily-checkin-${dateKey(new Date())}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
});
$("import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data.days || typeof data.days !== "object") throw new Error("missing days");
    if (!confirm("Replace the data on this device with the imported file?")) return;
    state.settings = { ...DEFAULT_SETTINGS, ...data.settings };
    state.days = data.days;
    save();
    fillSettings();
    render();
  } catch {
    alert("That file doesn't look like a Daily Check-in export.");
  } finally {
    e.target.value = "";
  }
});
$("reset").addEventListener("click", () => {
  if (!confirm("Erase all days and settings on this device?")) return;
  state.settings = { ...DEFAULT_SETTINGS };
  state.days = {};
  save();
  fillSettings();
  render();
});

document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

closeStaleDays();
tick();
setInterval(tick, 30000);
