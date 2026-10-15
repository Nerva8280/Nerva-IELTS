"use client";
import { useState } from "react";
import type { Catalog } from "@/lib/plan";
import type { AppState } from "@/lib/store";
import { addDays } from "@/lib/dates";
import { weekStart, SKILLS } from "@/lib/progress";
import { weekReport } from "@/lib/report";

const dm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

/** This week's (or last week's) study summary; the same report is sent as a notification on Sunday. */
export default function WeekReportCard({ s, catalog, today }: { s: AppState; catalog: Catalog; today: string }) {
  const [last, setLast] = useState(false);
  const day = last ? addDays(weekStart(today), -1) : today;
  const r = weekReport(s, catalog, day);
  const weak = SKILLS.find((k) => k.id === r.weakest);
  const stats = [
    { label: "Ngày học", value: r.planned ? `${r.studied}/${r.planned}` : String(r.studied) },
    { label: "Từ mới", value: r.learned },
    { label: "Lượt ôn từ", value: r.reviewed },
    { label: "Bài đã làm", value: r.lessons },
    { label: "Câu nói AI chấm", value: r.speaking },
    { label: "Lỗi sai đã ôn", value: r.mistakes },
  ];
  return (
    <div className="card mb-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="h2">📊 Báo cáo tuần</div>
          <div className="text-xs text-slate-500">
            {dm(r.start)} – {dm(r.end)}
          </div>
        </div>
        <div className="flex rounded-lg text-xs ring-1 ring-slate-200">
          {[false, true].map((v) => (
            <button key={String(v)} onClick={() => setLast(v)} className={`rounded-lg px-2.5 py-1 font-semibold ${last === v ? "bg-indigo-600 text-white" : "text-slate-600"}`}>
              {v ? "Tuần trước" : "Tuần này"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {stats.map((x) => (
          <div key={x.label} className="rounded-xl bg-slate-50 p-2">
            <div className="text-lg font-bold text-slate-800" style={{ fontVariantNumeric: "tabular-nums" }}>
              {x.value}
            </div>
            <div className="text-[11px] text-slate-500">{x.label}</div>
          </div>
        ))}
      </div>
      {r.bands.length > 0 && (
        <div className="mt-3 space-y-1 text-sm">
          {r.bands.map((b) => (
            <div key={b.skill} className="flex justify-between">
              <span>
                {b.icon} {b.name}
              </span>
              <span>
                <b>{b.band.toFixed(1)}</b>
                {b.change !== null && b.change !== 0 && (
                  <span className={`ml-1.5 text-xs font-semibold ${b.change > 0 ? "text-[#006300]" : "text-[#d03b3b]"}`}>
                    {b.change > 0 ? "▲" : "▼"} {Math.abs(b.change).toFixed(1)}
                  </span>
                )}
              </span>
            </div>
          ))}
          <p className="text-xs text-slate-400">Band trung bình các bài trong tuần, so với tuần trước.</p>
        </div>
      )}
      {!r.studied ? (
        <p className="mt-3 text-sm text-slate-600">{last ? "Tuần trước bạn chưa học buổi nào." : "Tuần này chưa có buổi học nào. Bắt đầu với 20 phút hôm nay nhé!"}</p>
      ) : (
        weak && (
          <p className="mt-3 text-sm text-slate-600">
            Tuần tới nên tập trung: <b>{weak.icon} {weak.name}</b>
          </p>
        )
      )}
      <p className="mt-2 text-xs text-slate-400">Tối Chủ nhật app gửi báo cáo này qua thông báo (nếu bạn đã bật nhắc học).</p>
    </div>
  );
}
