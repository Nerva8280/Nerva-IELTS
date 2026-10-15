// Weekly study report (Monday–Sunday): shown at the top of the progress page and sent as a push
// notification on Sunday evening by /api/cron/remind. Pure functions, used on server and client.
import type { AppState } from "./store";
import type { Catalog } from "./plan";
import { streakInfo } from "./plan";
import { SKILLS, skillPoints, weakestSkill, weekStart, type Skill } from "./progress";
import { addDays, weekday } from "./dates";

export interface WeekReport {
  start: string; // Monday
  end: string; // Sunday
  studied: number; // days with any study
  planned: number; // study days in the roadmap
  learned: number;
  reviewed: number;
  lessons: number; // lessons, exercises and tests finished
  mistakes: number; // notebook reviews
  speaking: number; // answers graded by AI
  writing: number; // essays graded by AI
  bands: { skill: Skill; name: string; icon: string; band: number; change: number | null }[]; // skills practised this week
  weakest: Skill | null;
  streak: number;
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 2) / 2 : null);

/** Progress data from the server may predate newer fields. */
function complete(s: Partial<AppState>): AppState {
  return { days: {}, done: {}, srs: {}, mocks: [], talks: [], writingGrades: [], mistakes: [], ...s } as AppState;
}

/** Report for the week that contains `day`, counting only up to `day`. */
export function weekReport(state: Partial<AppState>, catalog: Catalog, day: string): WeekReport {
  const s = complete(state);
  const start = weekStart(day);
  const end = addDays(start, 6);
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const inWeek = (d: string) => d >= start && d <= end && d <= day;
  let studied = 0,
    learned = 0,
    reviewed = 0,
    mistakes = 0;
  for (const d of week.filter(inWeek)) {
    const log = s.days[d];
    if (!log) continue;
    learned += log.learned ?? 0;
    reviewed += log.reviewed ?? 0;
    mistakes += log.mistakes ?? 0;
    if (log.learned || log.reviewed || log.done?.length || log.mistakes) studied++;
  }
  const pts = skillPoints(s, catalog);
  const bands = SKILLS.flatMap((k) => {
    const band = avg(pts[k.id].filter((p) => inWeek(p.date)).map((p) => p.band));
    if (band === null) return [];
    const prev = avg(pts[k.id].filter((p) => p.date >= addDays(start, -7) && p.date < start).map((p) => p.band));
    return [{ skill: k.id, name: k.name, icon: k.icon, band, change: prev === null ? null : band - prev }];
  });
  return {
    start,
    end,
    studied,
    planned: s.roadmap ? week.filter((d) => s.roadmap!.studyDays.includes(weekday(d))).length : 0,
    learned,
    reviewed,
    lessons: Object.values(s.done).filter((x) => inWeek(x.date)).length,
    mistakes,
    speaking: (s.talks ?? []).filter((t) => inWeek(t.date)).length,
    writing: (s.writingGrades ?? []).filter((w) => inWeek(w.date)).length,
    bands,
    weakest: weakestSkill(s, catalog, day),
    streak: streakInfo(s, day).days,
  };
}

/** One-paragraph summary for the Sunday notification. */
export function reportMessage(r: WeekReport): string {
  if (!r.studied) return "Tuần này bạn chưa học buổi nào. Tuần mới bắt đầu lại nhẹ nhàng nhé: chỉ cần 20 phút mỗi ngày 💪";
  const parts = [`Bạn học ${r.studied}${r.planned ? `/${r.planned}` : ""} ngày`];
  if (r.learned) parts.push(`${r.learned} từ mới`);
  if (r.lessons) parts.push(`${r.lessons} bài`);
  const up = r.bands.filter((b) => (b.change ?? 0) > 0).map((b) => `${b.name} ↑${b.band}`);
  const weak = SKILLS.find((k) => k.id === r.weakest);
  return `${parts.join(", ")}.${up.length ? ` Tiến bộ: ${up.join(", ")}.` : ""}${weak ? ` Tuần tới tập trung ${weak.name} ${weak.icon}.` : ""} Chuỗi: 🔥 ${r.streak} ngày.`;
}
