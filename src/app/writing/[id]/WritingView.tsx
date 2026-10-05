"use client";
import { useEffect, useState } from "react";
import type { WritingPrompt } from "@/content/types";
import { getState, markDone, update, useAppState } from "@/lib/store";
import { todayStr } from "@/lib/dates";
import DataChart, { chartKind } from "@/components/DataChart";
import { DoneBanner, fmtTime, LevelChip, PageHeader, SpeakButton, useTimer } from "@/components/ui";

const CHECKLIST = [
  ["Trả lời đúng & đủ yêu cầu đề", "Task Response / Achievement"],
  ["Mở bài – thân bài – kết bài rõ ràng, mỗi đoạn một ý chính", "Coherence & Cohesion"],
  ["Dùng từ nối đa dạng, không lặp", "Coherence & Cohesion"],
  ["Từ vựng theo chủ đề, có collocation, ít lặp từ", "Lexical Resource"],
  ["Có câu phức (mệnh đề quan hệ, điều kiện, bị động)", "Grammar"],
  ["Đã soát lỗi chia động từ, mạo từ, số ít/số nhiều", "Grammar"],
];

export default function WritingView({ item }: { item: WritingPrompt }) {
  const s = useAppState();
  const saved = s.essays[item.id];
  const [text, setText] = useState(() => getState().essays[item.id]?.text ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [hints, setHints] = useState(false);
  const [checks, setChecks] = useState<boolean[]>([]);
  const limit = item.id.startsWith("w0") ? 15 : item.task === 1 ? 20 : 40;
  const minWords = item.id.startsWith("w0") ? 120 : item.task === 1 ? 150 : 250;
  const [sec] = useTimer(!submitted && text.length > 0);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  // autosave draft
  useEffect(() => {
    const t = setTimeout(() => {
      if (text !== (getState().essays[item.id]?.text ?? ""))
        update((st) => void (st.essays[item.id] = { ...st.essays[item.id], text, date: todayStr() }));
    }, 1000);
    return () => clearTimeout(t);
  }, [text, item.id]);

  function submit() {
    setSubmitted(true);
    markDone(item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const selfBand = Math.min(9, 4 + checks.filter(Boolean).length * 0.5);

  return (
    <div>
      <PageHeader title={item.title} back="/practice" right={<LevelChip level={item.level} />} />
      <div className="card">
        <div className="mb-2 text-sm font-semibold text-indigo-600">
          {item.id.startsWith("w0") ? "Bài viết nền tảng" : `IELTS Writing Task ${item.task}`} · {limit} phút · tối thiểu {minWords} từ
        </div>
        <p className="whitespace-pre-line font-medium leading-relaxed">{item.prompt}</p>
        {item.data && <DataChart title={item.title} data={item.data} />}
        {item.data && (
          <details className="mt-3 overflow-x-auto" open={!chartKind(item.title, item.data)}>
            <summary className="cursor-pointer text-sm text-indigo-600">Bảng số liệu</summary>
            <div className="mb-1 text-sm font-semibold">{item.data.caption}</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  {item.data.headers.map((h) => (
                    <th key={h} className="px-2 py-1.5 text-left font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {item.data.rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {r.map((c, j) => (
                      <td key={j} className="px-2 py-1.5">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </div>

      <button className="btn-ghost mt-3 w-full" onClick={() => setHints((h) => !h)}>
        {hints ? "Ẩn gợi ý" : "💡 Xem gợi ý & dàn ý"}
      </button>
      {(hints || submitted) && (
        <div className="card mt-2 space-y-3 text-sm">
          <div>
            <div className="mb-1 font-semibold">Mẹo</div>
            <ul className="list-disc space-y-1 pl-5">
              {item.tipsVi.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-1 font-semibold">Dàn ý</div>
            <ol className="list-decimal space-y-1 pl-5">
              {item.outline.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          </div>
          <div>
            <div className="mb-1 font-semibold">Cụm từ hữu ích</div>
            {item.usefulPhrases.map((p) => (
              <div key={p.en}>
                <b>{p.en}</b>: {p.vi}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <div className="muted mb-1 flex justify-between">
          <span className={words >= minWords ? "font-semibold text-emerald-600" : ""}>
            {words}/{minWords} từ
          </span>
          <span className={sec > limit * 60 ? "font-semibold text-rose-600" : ""}>
            ⏱ {fmtTime(sec)} / {limit}:00
          </span>
        </div>
        <textarea
          className="input min-h-80 font-[inherit] leading-relaxed"
          placeholder="Viết bài của bạn ở đây… (tự động lưu nháp)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          autoCapitalize="sentences"
        />
        {!submitted && (
          <button className="btn-primary mt-3 w-full" disabled={words < 20} onClick={submit}>
            Nộp bài và xem bài mẫu
          </button>
        )}
        {saved?.selfBand && !submitted && <p className="muted mt-2">Lần trước bạn tự chấm ~{saved.selfBand}</p>}
      </div>

      {submitted && (
        <>
          <div className="card mt-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="h2">Bài mẫu (band ~{item.band})</div>
              <SpeakButton text={item.modelAnswer} label="Nghe" />
            </div>
            <div className="space-y-3 leading-relaxed">
              {item.modelAnswer.split(/\n\s*\n/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
          <div className="card mt-4">
            <div className="h2 mb-2">Tự chấm bài của bạn</div>
            <p className="muted mb-3">So sánh với bài mẫu và đánh dấu những điểm bạn đã làm được:</p>
            {CHECKLIST.map(([c, crit], i) => (
              <label key={c} className="flex items-start gap-3 py-1.5">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={!!checks[i]} onChange={(e) => setChecks((x) => Object.assign([...x], { [i]: e.target.checked }))} />
                <span>
                  {c} <span className="text-xs text-slate-400">({crit})</span>
                </span>
              </label>
            ))}
            {words < minWords && <p className="mt-2 text-sm text-rose-600">Bài chưa đủ {minWords} từ: thi thật sẽ bị trừ điểm.</p>}
            <div className="mt-3 text-sm">
              Band tự ước lượng: <b className="text-indigo-600">~{selfBand}</b>
            </div>
          </div>
          <DoneBanner>
            <button
              className="btn-soft"
              onClick={() => update((st) => void (st.essays[item.id] = { text, date: todayStr(), selfBand }))}
            >
              Lưu điểm tự chấm
            </button>
          </DoneBanner>
        </>
      )}
    </div>
  );
}
