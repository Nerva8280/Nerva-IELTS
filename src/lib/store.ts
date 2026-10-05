"use client";
// Learner progress: kept in localStorage and mirrored to /api/progress when signed in.
import { useSyncExternalStore } from "react";
import type { Level } from "@/content/types";
import type { SrsCard } from "./srs";
import type { PlanTask, RoadmapChoice } from "./plan";
import { todayStr } from "./dates";
import type { VoiceId } from "./audio-key";

export interface DayLog {
  plan?: PlanTask[];
  reviewed: number;
  learned: number;
  done: string[]; // task keys completed outside item tracking (e.g. "quiz")
}

export interface Settings {
  voice?: VoiceId; // preferred neural voice
  accent: "en-GB" | "en-US"; // follows the voice; used for speech recognition and browser fallback
  voiceF?: string;
  voiceM?: string;
  rate: number;
}

export interface PlacementResult {
  date: string;
  vocabSize: number;
  level: Level;
  bands: number[]; // adjusted known ratio per band
  falseAlarm: number;
}

export interface AppState {
  v: 1;
  owner?: string;
  updatedAt: number;
  level: Level;
  placement?: PlacementResult;
  roadmap?: RoadmapChoice;
  srs: Record<string, SrsCard>;
  done: Record<string, { date: string; score?: number; total?: number; count: number }>;
  days: Record<string, DayLog>;
  essays: Record<string, { text: string; date: string; selfBand?: number }>;
  mocks: { date: string; level: Level; score: number; total: number; band: number }[];
  pronChecks: { date: string; band: number; source: string }[]; // pronunciation self-assessments
  settings: Settings;
}

const KEY = "ielts-coach-state";

export function defaultState(): AppState {
  return {
    v: 1,
    updatedAt: 0,
    level: "A1",
    srs: {},
    done: {},
    days: {},
    essays: {},
    mocks: [],
    pronChecks: [],
    settings: { accent: "en-GB", rate: 0.95 },
  };
}

const SERVER_SNAPSHOT = defaultState();
let state: AppState = SERVER_SNAPSHOT;
let loaded = false;
const listeners = new Set<() => void>();

function normalize(raw: Partial<AppState>): AppState {
  const d = defaultState();
  return { ...d, ...raw, settings: { ...d.settings, ...(raw.settings ?? {}) } } as AppState;
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? normalize(JSON.parse(raw)) : defaultState();
  } catch {
    state = defaultState();
  }
}

export function getState(): AppState {
  ensureLoaded();
  return state;
}

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable */
  }
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, () => SERVER_SNAPSHOT);
}

export function update(fn: (s: AppState) => void) {
  const next = structuredClone(getState());
  fn(next);
  next.updatedAt = Date.now();
  state = next;
  persist();
  emit();
  scheduleSync();
}

export function replaceState(next: AppState) {
  state = normalize(next);
  persist();
  emit();
  scheduleSync();
}

export function dayLog(s: AppState, day = todayStr()): DayLog {
  return s.days[day] ?? { reviewed: 0, learned: 0, done: [] };
}

/** Mutating helper for use inside update(). */
export function touchDay(s: AppState, day = todayStr()): DayLog {
  s.days[day] ??= { reviewed: 0, learned: 0, done: [] };
  return s.days[day];
}

export function markDone(itemId: string, score?: number, total?: number) {
  update((s) => {
    const prev = s.done[itemId];
    s.done[itemId] = { date: todayStr(), score, total, count: (prev?.count ?? 0) + 1 };
    const log = touchDay(s);
    if (!log.done.includes(itemId)) log.done.push(itemId);
  });
}

// ---- Server sync -------------------------------------------------------------

let syncOn = false;
let timer: ReturnType<typeof setTimeout> | undefined;

function scheduleSync() {
  if (!syncOn) return;
  clearTimeout(timer);
  timer = setTimeout(pushNow, 1500);
}

async function pushNow(keepalive = false) {
  if (!syncOn) return;
  clearTimeout(timer);
  try {
    await fetch("/api/progress", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: state, updatedAt: state.updatedAt }),
      keepalive,
    });
  } catch {
    /* offline: will retry on next change */
  }
}

export async function startSync(owner: string) {
  ensureLoaded();
  if (state.owner && state.owner !== owner) {
    state = defaultState(); // another account used this device before
  }
  state.owner = owner;
  persist();
  try {
    const res = await fetch("/api/progress");
    if (res.ok) {
      const j = (await res.json()) as { data: AppState | null; updatedAt: number; enabled: boolean };
      if (!j.enabled) return emit();
      syncOn = true;
      if (j.data && j.updatedAt > state.updatedAt) {
        state = normalize({ ...j.data, owner });
        persist();
      } else if (state.updatedAt > (j.updatedAt ?? 0)) {
        void pushNow();
      }
    }
  } catch {
    syncOn = true;
  }
  emit();
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void pushNow(true);
    });
  }
}

export function stopSync() {
  syncOn = false;
  clearTimeout(timer);
}
