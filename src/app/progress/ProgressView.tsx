"use client";
import Link from "next/link";
import { useState } from "react";
import type { Catalog } from "@/lib/plan";
import { useAppState } from "@/lib/store";
import { addDays, todayStr } from "@/lib/dates";
import { SKILLS, recentBand, skillPoints, weakestSkill, weekly, type Skill } from "@/lib/progress";
import SkillChart from "@/components/SkillChart";
import { PageHeader } from "@/components/ui";

const PRACTICE: Record<Skill, { href: string; text: string }> = {
  speaking: { href: "/talk", text: "Luyện nói có AI chấm" },
  writing: { href: "/practice", text: "Viết 1 bài và bấm “AI chấm bài”" },
  listening: { href: "/dictation", text: "Nghe chép chính tả + bài Listening" },
  reading: { href: "/practice", text: "Làm thêm bài Reading" },
};

function Delta({ now, before }: { now: number | null; before: number | null }) {
  if (now === null || before === null) return null;
  const d = now - before;
  if (d === 0) return <span className="text-xs text-slate-500">= so với 4 tuần trước</span>;
  return (
    <span className={`text-xs font-semibold ${d > 0 ? "text-[#006300]" : "text-[#d03b3b]"}`}>
      {d > 0 ? "▲" : "▼"} {Math.abs(d).toFixed(1)} so với 4 tuần trước
    </span>
  );
}

export default function ProgressView({ catalog }: { catalog: Catalog }) {
  const s = useAppState();
  const today = todayStr();
  const [table, setTable] = useState(false);
  const pts = skillPoints(s, catalog);
  const weak = weakestSkill(s, catalog, today);
  const weeks = Object.fromEntries(SKILLS.map((k) => [k.id, weekly(pts[k.id], 12, today)])) as Record<Skill, ReturnType<typeof weekly>>;
  const dict = (s.dictation ?? []).slice(-50);
  const dictAcc = dict.length ? Math.round((dict.reduce((a, d) => a + d.correct, 0) / Math.max(1, dict.reduce((a, d) => a + d.total, 0))) * 100) : null;
  const pron = (s.pronChecks ?? []).slice(-5);
  const open = (s.mistakes ?? []).filter((m) => !m.mastered).length;
  const mastered = (s.mistakes ?? []).filter((m) => m.mastered).length;
  const hasAny = SKILLS.some((k) => pts[k.id].length);

  return (
    <div>
      <PageHeader title="📈 Tiến bộ" back="/" />

      {weak && (
        <div className="card mb-4 ring-amber-200">
          <div className="text-sm text-slate-500">Kỹ năng yếu nhất 4 tuần qua</div>
          <div className="mt-0.5 text-lg font-semibold">
            {SKILLS.find((k) => k.id === weak)!.icon} {SKILLS.find((k) => k.id === weak)!.name}
          </div>
          <p className="mt-1 text-sm text-slate-600">Lộ trình hằng ngày sẽ tự xen thêm bài luyện kỹ năng này. Bạn cũng có thể luyện ngay:</p>
          <Link href={PRACTICE[weak].href} className="btn-soft mt-2">
            {PRACTICE[weak].text} →
          </Link>
        </div>
      )}

      {!hasAny && (
        <div className="card mb-4 text-sm text-slate-600">
          Chưa có điểm nào. Biểu đồ sẽ hiện khi bạn làm bài Listening/Reading, luyện nói hoặc viết có AI chấm. Mỗi kỹ năng cần ít nhất 2 kết quả trong 4 tuần để so sánh.
        </div>
      )}

      <div className="space-y-3">
        {SKILLS.map((k) => {
          const now = recentBand(pts[k.id], 28, today, 1);
          const before = recentBand(pts[k.id].filter((p) => p.date < addDays(today, -28)), 28, addDays(today, -28), 1);
          return (
            <div key={k.id} className="card">
              <div className="mb-1 flex items-end justify-between gap-2">
                <div>
                  <div className="text-sm text-slate-500">
                    {k.icon} {k.name}
                  </div>
                  <div className="text-2xl font-semibold text-slate-900">{now !== null ? now.toFixed(1) : "—"}</div>
                </div>
                <div className="text-right">
                  <Delta now={now} before={before} />
                  <div className="text-xs text-slate-400">{pts[k.id].length} kết quả</div>
                </div>
              </div>
              {pts[k.id].length ? <SkillChart weeks={weeks[k.id]} label={k.name} /> : <p className="py-4 text-center text-sm text-slate-400">Chưa có dữ liệu</p>}
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <div className="card">
          <div className="text-xl font-semibold">{dictAcc !== null ? `${dictAcc}%` : "—"}</div>
          <div className="text-xs text-slate-500">nghe chép đúng</div>
        </div>
        <div className="card">
          <div className="text-xl font-semibold">{pron.length ? pron[pron.length - 1].band.toFixed(1) : "—"}</div>
          <div className="text-xs text-slate-500">phát âm tự chấm</div>
        </div>
        <Link href="/notebook" className="card">
          <div className="text-xl font-semibold">
            {mastered}/{mastered + open}
          </div>
          <div className="text-xs text-slate-500">lỗi đã nắm</div>
        </Link>
      </div>

      <button className="btn-ghost mt-4 w-full" onClick={() => setTable((t) => !t)}>
        {table ? "Ẩn" : "Xem"} bảng số liệu theo tuần
      </button>
      {table && (
        <div className="card mt-2 overflow-x-auto p-0">
          <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500">
                <th className="px-3 py-2 font-medium">Tuần</th>
                {SKILLS.map((k) => (
                  <th key={k.id} className="px-2 py-2 text-right font-medium">
                    {k.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...weeks.speaking.keys()].reverse().map((i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">
                    {weeks.speaking[i].start.slice(8)}/{weeks.speaking[i].start.slice(5, 7)}
                  </td>
                  {SKILLS.map((k) => (
                    <td key={k.id} className="px-2 py-1.5 text-right">
                      {weeks[k.id][i].band?.toFixed(1) ?? "–"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted mt-3 text-center text-xs">Listening/Reading là band ước tính từ điểm bài luyện theo trình độ; Speaking/Writing là điểm AI chấm.</p>
    </div>
  );
}
