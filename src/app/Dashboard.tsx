"use client";
import Link from "next/link";
import { useEffect } from "react";
import { LEVELS, type Level } from "@/content/types";
import { generatePlan, getRoadmap, isTaskDone, roadmapWeek, streak, type Catalog } from "@/lib/plan";
import { touchDay, update, useAppState } from "@/lib/store";
import { formatViDate, todayStr } from "@/lib/dates";
import { isDue } from "@/lib/srs";
import { LEVEL_INFO } from "@/lib/placement";
import { useAuth } from "@/components/AppShell";
import { LevelChip, ProgressBar } from "@/components/ui";

const ICONS: Record<string, string> = {
  review: "🔁",
  learn: "✨",
  grammar: "📐",
  reading: "📰",
  listening: "👂",
  writing: "✍️",
  speaking: "🗣️",
  shadowing: "🎧",
  pronunciation: "👄",
  quiz: "📝",
  mock: "🏁",
};

export default function Dashboard({ catalog, levelWords }: { catalog: Catalog; levelWords: Record<string, string[]> }) {
  const s = useAppState();
  const { me } = useAuth();
  const today = todayStr();
  const plan = s.days[today]?.plan;

  useEffect(() => {
    if (s.roadmap && !s.days[today]?.plan) update((st) => void (touchDay(st, today).plan = generatePlan(st, catalog, today)));
  }, [s.roadmap, s.days, today, catalog]);

  if (!s.roadmap || !s.placement) return null;
  const roadmap = getRoadmap(s.roadmap.id);
  const week = roadmapWeek(s.roadmap, today);
  const phase = roadmap.phases.find((p) => week >= p.from && week <= p.to) ?? roadmap.phases[roadmap.phases.length - 1];
  const tasks = plan ?? [];
  const doneCount = tasks.filter((t) => isTaskDone(t, s, today)).length;
  const allDone = tasks.length > 0 && doneCount === tasks.length;
  const minutes = tasks.reduce((a, t) => a + t.minutes, 0);
  const learned = Object.values(s.srs).filter((c) => !c.known).length;
  const due = Object.values(s.srs).filter((c) => isDue(c, today)).length;
  const days = streak(s, today);

  // Level-up: most words of the level learned and most grammar lessons done.
  const ids = levelWords[s.level] ?? [];
  const wordPct = ids.length ? ids.filter((id) => s.srs[id]).length / ids.length : 0;
  const gl = catalog.grammar.filter((g) => g.level === s.level);
  const gramPct = gl.length ? gl.filter((g) => s.done[g.id]).length / gl.length : 1;
  const nextLevel: Level | undefined = LEVELS[LEVELS.indexOf(s.level) + 1];
  const canLevelUp = !!nextLevel && wordPct >= 0.8 && gramPct >= 0.75;

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="muted">{formatViDate(today)}</div>
          <h1 className="h1">Chào {me?.user?.givenName ?? me?.user?.name?.split(" ")[0] ?? "bạn"} 👋</h1>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-orange-500">🔥 {days}</div>
          <div className="text-xs text-slate-500">ngày liên tiếp</div>
        </div>
      </div>

      <div className="card mb-4 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white ring-0">
        <div className="flex items-center justify-between text-sm text-indigo-100">
          <span>
            Lộ trình {roadmap.id} · {roadmap.name}
          </span>
          <span>
            Tuần {week}/{roadmap.weeks}
          </span>
        </div>
        <div className="mt-1 text-lg font-bold">Giai đoạn: {phase.title}</div>
        <ul className="mt-1 text-sm text-indigo-100">
          {phase.goals.map((g) => (
            <li key={g}>• {g}</li>
          ))}
        </ul>
        <ProgressBar value={Math.min(1, week / roadmap.weeks)} className="mt-3 bg-indigo-400/40" />
      </div>

      {canLevelUp && (
        <div className="card mb-4 bg-amber-50 ring-amber-200">
          <div className="font-semibold">🎉 Bạn đã sẵn sàng lên {nextLevel}!</div>
          <p className="muted mt-1">
            Đã học {Math.round(wordPct * 100)}% từ vựng và {Math.round(gramPct * 100)}% bài ngữ pháp của {s.level}.
          </p>
          <button
            className="btn-primary mt-3"
            onClick={() =>
              update((st) => {
                st.level = nextLevel!;
                if (st.days[today]) delete st.days[today].plan;
              })
            }
          >
            Lên {nextLevel}
          </button>
        </div>
      )}

      <div className="mb-2 flex items-end justify-between">
        <h2 className="h2">Bài học hôm nay</h2>
        <span className="muted">
          {doneCount}/{tasks.length} · ~{minutes} phút
        </span>
      </div>
      {tasks.length === 0 && plan && (
        <div className="card text-center text-slate-600">Hôm nay là ngày nghỉ 😌 Nghỉ ngơi để mai học tốt hơn!</div>
      )}
      <div className="space-y-2">
        {tasks.map((t) => {
          const done = isTaskDone(t, s, today);
          return (
            <Link key={t.key} href={t.href} className={`card flex items-center gap-3 transition hover:ring-indigo-300 ${done ? "opacity-60" : ""}`}>
              <span className="text-2xl">{ICONS[t.kind] ?? "📌"}</span>
              <div className="min-w-0 flex-1">
                <div className={`font-semibold ${done ? "line-through" : ""}`}>{t.title}</div>
                <div className="text-xs text-slate-500">~{t.minutes} phút</div>
              </div>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                {done ? "✓" : "→"}
              </span>
            </Link>
          );
        })}
      </div>
      {allDone && (
        <div className="card mt-3 bg-emerald-50 text-center ring-emerald-200">
          <div className="text-2xl">🎉</div>
          <div className="font-semibold">Hoàn thành bài học hôm nay!</div>
          <p className="muted">Muốn học thêm? Vào mục Luyện tập hoặc Shadowing.</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        <div className="card">
          <div className="text-xl font-bold">{learned}</div>
          <div className="text-xs text-slate-500">từ đã học</div>
        </div>
        <div className="card">
          <div className="text-xl font-bold">{due}</div>
          <div className="text-xs text-slate-500">từ cần ôn</div>
        </div>
        <Link href="/settings" className="card">
          <div className="flex justify-center">
            <LevelChip level={s.level} />
          </div>
          <div className="mt-1 text-xs text-slate-500">IELTS ~{LEVEL_INFO[s.level].band}</div>
        </Link>
      </div>
      <div className="card mt-3">
        <div className="mb-1 flex justify-between text-sm">
          <span>Từ vựng {s.level}</span>
          <span className="text-slate-500">{Math.round(wordPct * 100)}%</span>
        </div>
        <ProgressBar value={wordPct} />
        <div className="mb-1 mt-3 flex justify-between text-sm">
          <span>Ngữ pháp {s.level}</span>
          <span className="text-slate-500">{Math.round(gramPct * 100)}%</span>
        </div>
        <ProgressBar value={gramPct} />
      </div>
    </div>
  );
}
