"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROADMAPS, recommendRoadmap, MINUTE_CONFIG, type RoadmapId, getRoadmap, roadmapWeek, KIND_VI } from "@/lib/plan";
import { update, useAppState } from "@/lib/store";
import { todayStr, WEEKDAY_VI } from "@/lib/dates";
import { LEVEL_INFO } from "@/lib/placement";
import { LevelChip, PageHeader } from "@/components/ui";

export default function RoadmapPage() {
  const router = useRouter();
  const s = useAppState();
  const rec = recommendRoadmap(s.level);
  const [id, setId] = useState<RoadmapId>(s.roadmap?.id ?? rec);
  const [minutes, setMinutes] = useState<20 | 25 | 30>(s.roadmap?.minutes ?? 25);
  const [days, setDays] = useState<number[]>(s.roadmap?.studyDays ?? [1, 2, 3, 4, 5, 6]);
  const [reminder, setReminder] = useState(s.roadmap?.reminder ?? "20:30");
  const r = getRoadmap(id);
  const week = s.roadmap?.id === id ? roadmapWeek(s.roadmap, todayStr()) : 1;

  function save() {
    update((st) => {
      const keepStart = st.roadmap?.id === id ? st.roadmap.startDate : todayStr();
      st.roadmap = { id, minutes, studyDays: [...days].sort(), reminder, startDate: keepStart };
      const today = st.days[todayStr()];
      if (today) delete today.plan; // regenerate today's plan with the new settings
    });
    router.push("/");
  }

  return (
    <div>
      <PageHeader title="Chọn lộ trình" back={s.roadmap ? "/settings" : undefined} />
      <div className="card mb-4 flex items-center gap-3">
        <LevelChip level={s.level} />
        <div className="text-sm">
          Trình độ hiện tại: <b>{LEVEL_INFO[s.level].name}</b> · IELTS ~{LEVEL_INFO[s.level].band}
        </div>
      </div>

      <div className="space-y-3">
        {ROADMAPS.map((x) => (
          <button
            key={x.id}
            onClick={() => setId(x.id)}
            className={`card w-full text-left transition ${id === x.id ? "ring-2 ring-indigo-500" : ""}`}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 font-bold text-white">{x.id}</span>
              <div className="flex-1">
                <div className="font-bold">{x.name}</div>
                <div className="muted">
                  {x.weeks} tuần · {x.target}
                </div>
              </div>
              {x.id === rec && <span className="chip bg-amber-100 text-amber-700">Đề xuất</span>}
            </div>
            <p className="mt-2 text-sm text-slate-600">{x.summary}</p>
          </button>
        ))}
      </div>

      <div className="card mt-4">
        <div className="h2">Các giai đoạn của lộ trình {r.id}</div>
        <div className="mt-3 space-y-3">
          {r.phases.map((p) => {
            const active = week >= p.from && week <= p.to;
            return (
              <div key={p.title} className={`rounded-xl border p-3 ${active ? "border-indigo-400 bg-indigo-50" : "border-slate-200"}`}>
                <div className="flex justify-between text-sm font-semibold">
                  <span>{p.title}</span>
                  <span className="text-slate-500">
                    Tuần {p.from}–{p.to}
                  </span>
                </div>
                <ul className="mt-1 list-disc pl-5 text-sm text-slate-600">
                  {p.goals.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-sm">
          <div className="mb-2 font-semibold">Lịch trọng tâm mỗi tuần</div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <div key={d} className="rounded-lg bg-slate-100 p-1.5">
                <div className="font-bold">{WEEKDAY_VI[d]}</div>
                <div className="mt-1 text-slate-600">{days.includes(d) ? KIND_VI[r.week[d] === "rest" ? "grammar" : r.week[d]] : "Nghỉ"}</div>
              </div>
            ))}
          </div>
          <p className="muted mt-2">Mỗi ngày học: ôn từ (SRS) → từ mới → bài trọng tâm → shadowing.</p>
        </div>
      </div>

      <div className="card mt-4 space-y-4">
        <div>
          <div className="h2 mb-2">Thời gian mỗi ngày</div>
          <div className="flex gap-2">
            {([20, 25, 30] as const).map((m) => (
              <button key={m} onClick={() => setMinutes(m)} className={minutes === m ? "btn-primary flex-1" : "btn-ghost flex-1"}>
                {m} phút
              </button>
            ))}
          </div>
          <p className="muted mt-1">
            {MINUTE_CONFIG[minutes].newWords} từ mới/ngày, ôn tối đa {MINUTE_CONFIG[minutes].reviewCap} từ.
          </p>
        </div>
        <div>
          <div className="h2 mb-2">Ngày học trong tuần</div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button
                key={d}
                onClick={() => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold ${days.includes(d) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}
              >
                {WEEKDAY_VI[d]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="h2 mb-2">Giờ học (để nhắc nhở)</div>
          <input type="time" className="input w-40" value={reminder} onChange={(e) => setReminder(e.target.value)} />
          <p className="muted mt-1">Bật thông báo hoặc thêm vào lịch điện thoại trong mục Cài đặt.</p>
        </div>
      </div>

      <button className="btn-primary mt-6 w-full py-3 text-base" disabled={!days.length} onClick={save}>
        {s.roadmap ? "Lưu thay đổi" : "Bắt đầu học"}
      </button>
    </div>
  );
}
