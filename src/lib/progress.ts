// Band history per skill, bucketed by week, for the progress page and the adaptive daily plan.
import type { Level } from "@/content/types";
import type { AppState } from "./store";
import type { Catalog } from "./plan";
import { addDays, parseDay, todayStr } from "./dates";

export type Skill = "speaking" | "writing" | "listening" | "reading";
export const SKILLS: { id: Skill; name: string; icon: string }[] = [
  { id: "speaking", name: "Speaking", icon: "🗣️" },
  { id: "writing", name: "Writing", icon: "✍️" },
  { id: "listening", name: "Listening", icon: "👂" },
  { id: "reading", name: "Reading", icon: "📰" },
];

const BASE_BAND: Record<Level, number> = { A1: 2.5, A2: 3.5, B1: 4.5, B2: 5.5, C1: 6.5 };

/** Rough band from a score on a practice item of a given level (used for listening/reading). */
export function estimateBand(level: Level, pct: number) {
  const adj = pct >= 0.85 ? 1 : pct >= 0.7 ? 0.5 : pct >= 0.5 ? 0 : -0.5;
  return Math.max(1, Math.min(9, BASE_BAND[level] + adj));
}

/** Monday of the week containing the date. */
export function weekStart(day: string): string {
  const d = parseDay(day);
  return addDays(day, -((d.getDay() + 6) % 7));
}

export interface Point {
  date: string;
  band: number;
}

/** Every band result per skill, oldest first. */
export function skillPoints(s: AppState, catalog: Catalog): Record<Skill, Point[]> {
  const levelOf = new Map([...catalog.listening, ...catalog.reading].map((i) => [i.id, i.level]));
  const out: Record<Skill, Point[]> = { speaking: [], writing: [], listening: [], reading: [] };
  for (const t of s.talks ?? []) if (t.bands.overall > 0) out.speaking.push({ date: t.date, band: t.bands.overall });
  for (const w of s.writingGrades ?? []) if (w.bands.overall > 0) out.writing.push({ date: w.date, band: w.bands.overall });
  for (const [id, d] of Object.entries(s.done)) {
    const level = levelOf.get(id);
    if (!level || !d.total) continue;
    const kind: Skill = id.startsWith("l-") ? "listening" : "reading";
    out[kind].push({ date: d.date, band: estimateBand(level, (d.score ?? 0) / d.total) });
  }
  for (const m of s.mocks) for (const k of ["listening", "reading"] as const) out[k].push({ date: m.date, band: m.band });
  for (const k of Object.keys(out) as Skill[]) out[k].sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export interface Week {
  start: string; // Monday
  band: number | null; // average of the week, rounded to .5
  count: number;
}

export function weekly(points: Point[], weeks = 12, today = todayStr()): Week[] {
  const last = weekStart(today);
  return Array.from({ length: weeks }, (_, k) => {
    const start = addDays(last, -7 * (weeks - 1 - k));
    const end = addDays(start, 7);
    const xs = points.filter((p) => p.date >= start && p.date < end).map((p) => p.band);
    return { start, count: xs.length, band: xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 2) / 2 : null };
  });
}

/** Average band over the last `days` days, or null with too little data. */
export function recentBand(points: Point[], days = 28, today = todayStr(), min = 2): number | null {
  const from = addDays(today, -days);
  const xs = points.filter((p) => p.date >= from).map((p) => p.band);
  return xs.length >= min ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 2) / 2 : null;
}

/** The skill with the lowest recent band (needs data on at least two skills to compare). */
export function weakestSkill(s: AppState, catalog: Catalog, today = todayStr()): Skill | null {
  const pts = skillPoints(s, catalog);
  const scored = SKILLS.map((k) => ({ id: k.id, band: recentBand(pts[k.id], 28, today) })).filter((x): x is { id: Skill; band: number } => x.band !== null);
  if (scored.length < 2) return null;
  return scored.sort((a, b) => a.band - b.band)[0].id;
}
