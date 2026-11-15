import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { AppState } from 'react-native';
import { createEmptyData } from '@/models/defaults';
import type { AppData, Category, SeriesScope, Settings, TaskDraft, TaskStatus, TimeKey, DateKey } from '@/models/types';
import * as ops from '@/logic/taskOps';
import { todayKey } from '@/logic/dates';
import { buildSampleData } from '@/logic/sampleData';
import type { DataRepository } from '@/storage/repository';
import { localRepository } from '@/storage/localRepository';
import { configureNotifications, syncNotifications } from '@/services/notifications';

interface State {
  ready: boolean;
  loadError: string | null;
  data: AppData;
  today: DateKey;
}

type Action =
  | { type: 'loaded'; data: AppData; today: DateKey }
  | { type: 'load_failed'; error: string; today: DateKey }
  | { type: 'apply'; fn: (d: AppData, today: DateKey) => AppData }
  | { type: 'day_changed'; today: DateKey };

const now = () => new Date().toISOString();

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loaded':
      return { ready: true, loadError: null, today: action.today, data: ops.materialize(action.data, action.today, now()) };
    case 'load_failed':
      return { ...state, ready: true, loadError: action.error, today: action.today };
    case 'apply': {
      const data = action.fn(state.data, state.today);
      return data === state.data ? state : { ...state, data };
    }
    case 'day_changed':
      return { ...state, today: action.today, data: ops.materialize(state.data, action.today, now()) };
  }
}

export interface AppActions {
  createTask(draft: TaskDraft): void;
  updateTask(id: string, draft: TaskDraft, scope: SeriesScope): void;
  deleteTask(id: string, scope: SeriesScope): void;
  setStatus(id: string, status: TaskStatus): void;
  toggleComplete(id: string): void;
  reschedule(id: string, date: DateKey, time?: TimeKey | null): void;
  snooze(id: string, minutes?: number): void;
  updateSettings(patch: Partial<Settings>): void;
  addCategory(input: Pick<Category, 'name' | 'emoji' | 'color'>): void;
  updateCategory(id: string, input: Pick<Category, 'name' | 'emoji' | 'color'>): void;
  deleteCategory(id: string): void;
  loadSampleData(): void;
  resetAll(): Promise<void>;
}

interface Ctx extends State {
  actions: AppActions;
}

const AppContext = createContext<Ctx | null>(null);

export function AppStoreProvider({ children, repository = localRepository }: { children: React.ReactNode; repository?: DataRepository }) {
  const [state, dispatch] = useReducer(reducer, {
    ready: false,
    loadError: null,
    data: createEmptyData(),
    today: todayKey(),
  });

  // ---- Load ----
  useEffect(() => {
    let cancelled = false;
    repository
      .load()
      .then((data) => !cancelled && dispatch({ type: 'loaded', data: data ?? createEmptyData(), today: todayKey() }))
      .catch((e) => !cancelled && dispatch({ type: 'load_failed', error: String(e?.message ?? e), today: todayKey() }));
    return () => {
      cancelled = true;
    };
  }, [repository]);

  // ---- Persist (debounced, flushed when app goes to background) ----
  const latest = useRef(state.data);
  useEffect(() => {
    latest.current = state.data;
  }, [state.data]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    repository.save(latest.current).catch((e) => console.warn('[storage] save failed', e));
  }, [repository]);

  useEffect(() => {
    if (!state.ready || state.loadError) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 250);
  }, [state.data, state.ready, state.loadError, flush]);

  // ---- Day rollover: check every minute and whenever the app comes back ----
  const todayRef = useRef(state.today);
  useEffect(() => {
    todayRef.current = state.today;
  }, [state.today]);
  useEffect(() => {
    const check = () => {
      const t = todayKey();
      if (t !== todayRef.current) dispatch({ type: 'day_changed', today: t });
    };
    const id = setInterval(check, 60_000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
      else if (s === 'background') flush();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [flush]);

  // ---- Notifications (debounced resync) ----
  useEffect(() => {
    if (!state.ready) return;
    configureNotifications(state.data.settings.snoozeMinutes).catch(() => {});
  }, [state.ready, state.data.settings.snoozeMinutes]);

  useEffect(() => {
    if (!state.ready) return;
    const id = setTimeout(() => syncNotifications(state.data), 800);
    return () => clearTimeout(id);
  }, [state.ready, state.data]);

  const actions = useMemo<AppActions>(() => {
    const apply = (fn: (d: AppData, today: DateKey) => AppData) => dispatch({ type: 'apply', fn });
    return {
      createTask: (draft) => apply((d, today) => ops.createTask(d, draft, today, now())),
      updateTask: (id, draft, scope) => apply((d, today) => ops.updateTask(d, id, draft, scope, today, now())),
      deleteTask: (id, scope) => apply((d) => ops.deleteTask(d, id, scope, now())),
      setStatus: (id, status) => apply((d) => ops.setStatus(d, id, status, now())),
      toggleComplete: (id) => apply((d) => ops.toggleComplete(d, id, now())),
      reschedule: (id, date, time) => apply((d) => ops.reschedule(d, id, date, time, now())),
      snooze: (id, minutes) =>
        apply((d) => {
          const mins = minutes ?? d.settings.snoozeMinutes;
          return ops.snooze(d, id, new Date(Date.now() + mins * 60_000).toISOString(), now());
        }),
      updateSettings: (patch) => apply((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
      addCategory: (input) => apply((d) => ops.addCategory(d, input, now())),
      updateCategory: (id, input) => apply((d) => ops.updateCategory(d, id, input)),
      deleteCategory: (id) => apply((d) => ops.deleteCategory(d, id, now())),
      loadSampleData: () => apply((d, today) => buildSampleData(d, today, new Date())),
      resetAll: async () => {
        await repository.clear();
        apply(() => createEmptyData());
      },
    };
  }, [repository]);

  const value = useMemo<Ctx>(() => ({ ...state, actions }), [state, actions]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppStoreProvider');
  return ctx;
}
