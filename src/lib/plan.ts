// Roadmaps and the daily plan generator.
import { LEVELS, type Level } from "@/content/types";
import type { AppState } from "./store";
import { addDays, diffDays, weekday } from "./dates";
import { isDue } from "./srs";

export type ItemKind = "grammar" | "reading" | "listening" | "writing" | "speaking" | "shadowing" | "pronunciation";
export interface CatalogItem {
  id: string;
  level: Level;
  title: string;
  kind: ItemKind;
  sub?: string; // e.g. "Task 2", "Part 1"
}
export type Catalog = Record<ItemKind, CatalogItem[]>;

export type Focus = ItemKind | "quiz" | "mock" | "rest";
export type RoadmapId = "A" | "B" | "C" | "D";

export interface Roadmap {
  id: RoadmapId;
  name: string;
  weeks: number;
  target: string;
  bestFor: Level[];
  summary: string;
  week: Focus[]; // index 0 = Sunday
  phases: { from: number; to: number; title: string; goals: string[] }[];
}

export const ROADMAPS: Roadmap[] = [
  {
    id: "A",
    name: "Nền tảng",
    weeks: 12,
    target: "A1 → A2/B1",
    bestFor: ["A1", "A2"],
    summary: "Xây vốn từ 1.200 từ thông dụng, ngữ pháp cơ bản, phát âm và nghe hội thoại đời thường.",
    week: ["rest", "grammar", "listening", "grammar", "reading", "speaking", "quiz"],
    phases: [
      { from: 1, to: 4, title: "Làm quen", goals: ["~300 từ thông dụng nhất", "Thì hiện tại, to be, there is/are", "Shadowing câu ngắn hằng ngày"] },
      { from: 5, to: 8, title: "Mở rộng", goals: ["+300–400 từ", "Quá khứ, tương lai, so sánh", "Nghe hội thoại ngắn"] },
      { from: 9, to: 12, title: "Chạm IELTS", goals: ["Đọc bài ngắn, câu hỏi True/False", "Nói về bản thân (Speaking Part 1)", "Làm lại bài test đầu vào"] },
    ],
  },
  {
    id: "B",
    name: "IELTS 5.0 – 5.5",
    weeks: 26,
    target: "B1 → band 5.5",
    bestFor: ["A2", "B1"],
    summary: "Đủ 4 kỹ năng theo format IELTS ở mức trung cấp, viết được bài Task 2 cơ bản.",
    week: ["rest", "grammar", "listening", "reading", "speaking", "writing", "quiz"],
    phases: [
      { from: 1, to: 8, title: "Củng cố", goals: ["Từ vựng B1 (2.000–2.500 từ)", "Ngữ pháp trung cấp: hoàn thành, bị động, câu điều kiện", "Shadowing tốc độ chậm → vừa"] },
      { from: 9, to: 17, title: "Kỹ năng IELTS", goals: ["Listening Part 1–2", "Reading: TFNG, điền từ", "Writing Task 1: mẫu câu mô tả số liệu"] },
      { from: 18, to: 26, title: "Hoàn thiện", goals: ["Writing Task 2 cấu trúc 4 đoạn", "Speaking Part 1–2", "Mock test mini 2 tuần/lần"] },
    ],
  },
  {
    id: "C",
    name: "IELTS 6.0 – 6.5",
    weeks: 48,
    target: "B2 → band 6.5",
    bestFor: ["B1", "B2"],
    summary: "Từ vựng học thuật, kỹ năng làm bài chuyên sâu, viết/nói có lập luận.",
    week: ["rest", "grammar", "listening", "reading", "speaking", "writing", "mock"],
    phases: [
      { from: 1, to: 12, title: "Nền học thuật", goals: ["Từ vựng B2 + collocations", "Câu phức, mệnh đề quan hệ, liên kết câu", "Shadowing câu trả lời Part 2/3"] },
      { from: 13, to: 24, title: "Đọc & nghe chuyên sâu", goals: ["Reading bài dài 550+ từ", "Listening Part 3 (thảo luận)", "Từ vựng học thuật (AWL)"] },
      { from: 25, to: 36, title: "Viết & nói", goals: ["Task 1 đủ dạng biểu đồ", "Task 2 đủ 5 dạng đề", "Speaking Part 3: mở rộng ý"] },
      { from: 37, to: 48, title: "Luyện đề", goals: ["Mock test hằng tuần", "Sửa lỗi lặp lại", "Làm lại bài kiểm tra trình độ"] },
    ],
  },
  {
    id: "D",
    name: "Tăng tốc IELTS",
    weeks: 13,
    target: "B2/C1 → band 6.5–7+",
    bestFor: ["B2", "C1"],
    summary: "Đã có nền tốt: tập trung format đề, Writing/Speaking và mock test.",
    week: ["rest", "listening", "reading", "writing", "speaking", "writing", "mock"],
    phases: [
      { from: 1, to: 4, title: "Nắm format", goals: ["Mỗi dạng câu hỏi Reading/Listening", "Task 1 & Task 2 khung bài", "Từ vựng C1 theo chủ đề"] },
      { from: 5, to: 9, title: "Nâng band", goals: ["Đảo ngữ, danh từ hóa, hedging", "Listening Part 4 (bài giảng)", "Speaking Part 3 band 7"] },
      { from: 10, to: 13, title: "Về đích", goals: ["Mock test mỗi tuần", "Ôn từ vựng sai nhiều", "Giữ nhịp shadowing mỗi ngày"] },
    ],
  },
];

export const MINUTE_CONFIG = {
  20: { newWords: 5, reviewCap: 30 },
  25: { newWords: 8, reviewCap: 40 },
  30: { newWords: 10, reviewCap: 50 },
} as const;

export interface RoadmapChoice {
  id: RoadmapId;
  startDate: string;
  minutes: 20 | 25 | 30;
  studyDays: number[]; // 0 = Sunday
  reminder: string; // "HH:MM"
}

export function recommendRoadmap(level: Level): RoadmapId {
  return level === "A1" || level === "A2" ? "A" : level === "B1" ? "B" : level === "B2" ? "C" : "D";
}

export function getRoadmap(id: RoadmapId): Roadmap {
  return ROADMAPS.find((r) => r.id === id)!;
}

export function roadmapWeek(choice: RoadmapChoice, today: string): number {
  return Math.floor(Math.max(0, diffDays(choice.startDate, today)) / 7) + 1;
}

export interface PlanTask {
  key: string;
  kind: "review" | "learn" | Focus;
  title: string;
  minutes: number;
  href: string;
  itemId?: string;
  target?: number;
}

export const KIND_VI: Record<string, string> = {
  review: "Ôn từ vựng",
  learn: "Học từ mới",
  grammar: "Ngữ pháp",
  reading: "Reading",
  listening: "Listening",
  writing: "Writing",
  speaking: "Speaking",
  shadowing: "Shadowing",
  pronunciation: "Phát âm",
  quiz: "Kiểm tra từ vựng",
  mock: "Mock test mini",
  rest: "Nghỉ",
};

const levelIdx = (l: Level) => LEVELS.indexOf(l);

/** Next item of a kind for the learner: unseen at their level first, then nearby levels, then the weakest one. */
export function nextItem(catalog: Catalog, kind: ItemKind, s: AppState, exclude: string[] = []): CatalogItem | undefined {
  const items = catalog[kind].filter((i) => !exclude.includes(i.id));
  const li = levelIdx(s.level);
  const byDistance = [...items].sort((a, b) => {
    const da = levelIdx(a.level) - li;
    const db = levelIdx(b.level) - li;
    // same level first, then one below, then above
    const rank = (d: number) => (d === 0 ? 0 : d < 0 ? -d * 2 - 1 : d * 2);
    return rank(da) - rank(db);
  });
  const fresh = byDistance.find((i) => !s.done[i.id]);
  if (fresh) return fresh;
  const near = byDistance.filter((i) => Math.abs(levelIdx(i.level) - li) <= 1);
  return [...near].sort((a, b) => ratio(s, a.id) - ratio(s, b.id))[0];
}

function ratio(s: AppState, id: string) {
  const d = s.done[id];
  return d?.total ? (d.score ?? 0) / d.total : 1;
}

const itemHref = (kind: ItemKind, id: string) => `/${kind}/${id}`;

export function generatePlan(s: AppState, catalog: Catalog, today: string): PlanTask[] {
  const choice = s.roadmap;
  if (!choice) return [];
  const roadmap = getRoadmap(choice.id);
  const cfg = MINUTE_CONFIG[choice.minutes];
  const due = Object.values(s.srs).filter((c) => isDue(c, today)).length;
  const wd = weekday(today);
  const tasks: PlanTask[] = [];

  if (!choice.studyDays.includes(wd)) {
    if (due > 0)
      tasks.push({ key: "review", kind: "review", title: `Ôn nhẹ ${Math.min(due, 20)} từ (không bắt buộc)`, minutes: 5, href: "/vocab?mode=review", target: Math.min(due, 20) });
    return tasks;
  }

  if (due > 0)
    tasks.push({ key: "review", kind: "review", title: `Ôn ${Math.min(due, cfg.reviewCap)} từ đến hạn`, minutes: 5, href: "/vocab?mode=review", target: Math.min(due, cfg.reviewCap) });
  tasks.push({ key: "learn", kind: "learn", title: `Học ${cfg.newWords} từ mới`, minutes: 5, href: "/vocab?mode=learn", target: cfg.newWords });

  let focus = roadmap.week[wd];
  if (focus === "rest") focus = "grammar"; // learner chose to study on the roadmap's rest day
  // Learners below B1 do not get full IELTS writing tasks yet: swap for reading practice.
  if (focus === "writing" && levelIdx(s.level) < 1) focus = "reading";
  if (focus === "mock" && roadmapWeek(choice, today) % 2 === 0 && roadmap.id !== "D") focus = "quiz";

  if (focus === "quiz") {
    tasks.push({ key: "quiz", kind: "quiz", title: "Kiểm tra nhanh 15 từ đã học", minutes: 6, href: "/vocab?mode=quiz" });
  } else if (focus === "mock") {
    tasks.push({ key: "mock", kind: "mock", title: "Mock test mini (Listening + Reading)", minutes: 15, href: "/mock" });
  } else {
    const item = nextItem(catalog, focus, s);
    if (item)
      tasks.push({ key: item.id, kind: focus, itemId: item.id, title: `${KIND_VI[focus]}: ${item.title}`, minutes: focus === "writing" ? 12 : 9, href: itemHref(focus, item.id) });
  }

  if (focus !== "mock") {
    // Every other study day, a pronunciation drill replaces shadowing until all drills are done.
    const pron = nextItem(catalog, "pronunciation", s);
    const usePron = !!pron && !s.done[pron.id] && diffDays(choice.startDate, today) % 2 === 1;
    const sh = usePron ? pron : nextItem(catalog, "shadowing", s);
    const kind = usePron ? "pronunciation" : "shadowing";
    if (sh) tasks.push({ key: sh.id, kind, itemId: sh.id, title: `${KIND_VI[kind]}: ${sh.title}`, minutes: 6, href: itemHref(kind, sh.id) });
  }
  return tasks;
}

export function isTaskDone(t: PlanTask, s: AppState, today: string): boolean {
  const log = s.days[today];
  if (t.kind === "review") {
    const remaining = Object.values(s.srs).filter((c) => isDue(c, today)).length;
    return remaining === 0 || (log?.reviewed ?? 0) >= (t.target ?? 0);
  }
  if (t.kind === "learn") return (log?.learned ?? 0) >= (t.target ?? 0);
  if (t.kind === "quiz") return !!log?.done.includes("quiz");
  if (t.kind === "mock") return s.mocks.some((m) => m.date === today);
  return !!t.itemId && s.done[t.itemId]?.date === today;
}

/** Consecutive study days (rest days are skipped) on which every planned task was completed. */
export function streak(s: AppState, today: string): number {
  const choice = s.roadmap;
  if (!choice) return 0;
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const d = addDays(today, -i);
    if (d < choice.startDate) break;
    if (!choice.studyDays.includes(weekday(d))) continue;
    const plan = s.days[d]?.plan;
    const complete = !!plan?.length && plan.every((t) => isTaskDoneOn(t, s, d));
    if (complete) n++;
    else if (i > 0) break; // today may still be in progress
  }
  return n;
}

// Past-day completion: the plan snapshot is checked against that day's logs.
function isTaskDoneOn(t: PlanTask, s: AppState, day: string): boolean {
  const log = s.days[day];
  if (t.kind === "review") return (log?.reviewed ?? 0) >= (t.target ?? 0) || !!log?.done.includes("review-clear");
  if (t.kind === "learn") return (log?.learned ?? 0) >= (t.target ?? 0);
  if (t.kind === "quiz") return !!log?.done.includes("quiz");
  if (t.kind === "mock") return s.mocks.some((m) => m.date === day);
  return !!t.itemId && !!log?.done.includes(t.itemId);
}
