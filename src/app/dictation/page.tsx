"use client";
import { useEffect, useMemo, useState } from "react";
import { LEVELS, type Level } from "@/content/types";
import type { DictationItem } from "@/app/api/content/dictation/route";
import { getState, update, useAppState } from "@/lib/store";
import { todayStr } from "@/lib/dates";
import { checkDictation, type DictationResult } from "@/lib/dictation";
import { addMistakes } from "@/lib/notebook";
import { playNative, stopSpeaking } from "@/lib/tts";
import { Credit, DoneBanner, PageHeader, ProgressBar } from "@/components/ui";

const SESSION = 10;

let cache: Promise<DictationItem[]> | null = null;
function useItems() {
  const [items, setItems] = useState<DictationItem[] | null>(null);
  useEffect(() => {
    cache ??= fetch("/api/content/dictation").then((r) => r.json());
    cache.then(setItems, () => setItems([]));
  }, []);
  return items;
}

export default function DictationPage() {
  const s = useAppState();
  const items = useItems();
  const [level, setLevel] = useState<Level>(s.level);
  const [session, setSession] = useState<DictationItem[] | null>(null);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<DictationResult | null>(null);
  const [scores, setScores] = useState<{ correct: number; total: number }[]>([]);
  const it = session?.[i];

  const history = s.dictation ?? [];
  const recent = history.slice(-50);
  const accuracy = recent.length ? Math.round((recent.reduce((a, d) => a + d.correct, 0) / Math.max(1, recent.reduce((a, d) => a + d.total, 0))) * 100) : null;
  const pool = useMemo(() => (items ?? []).filter((x) => x.level === level), [items, level]);

  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => {
    if (it) void playNative(it.aid);
  }, [it]);

  function start() {
    const seen = new Set((getState().dictation ?? []).map((d) => d.aid));
    const fresh = pool.filter((x) => !seen.has(x.aid));
    const from = fresh.length >= SESSION ? fresh : pool;
    setSession([...from].sort(() => Math.random() - 0.5).slice(0, SESSION));
    setI(0);
    setTyped("");
    setResult(null);
    setScores([]);
  }

  function check() {
    if (!it) return;
    const r = checkDictation(it.text, typed);
    setResult(r);
    setScores((x) => [...x, { correct: r.correct, total: r.total }]);
    update((st) => void (st.dictation = [...(st.dictation ?? []), { date: todayStr(), aid: it.aid, correct: r.correct, total: r.total }].slice(-1000)));
    if (r.correct < r.total) addMistakes([{ source: "Nghe chép chính tả", kind: "exercise", original: typed.trim() || "(bỏ trống)", corrected: it.text, explanationVi: it.vi ?? "" }]);
  }

  function next() {
    stopSpeaking();
    setI(i + 1);
    setTyped("");
    setResult(null);
  }

  if (!items) return <div className="pt-10 text-center text-slate-400">Đang tải…</div>;

  if (!session)
    return (
      <div>
        <PageHeader title="✍️ Nghe chép chính tả" back="/practice" />
        <div className="card text-sm leading-relaxed text-slate-600">
          Nghe câu do <b>người bản xứ</b> đọc, gõ lại chính xác những gì bạn nghe được. App tô <span className="font-semibold text-emerald-600">xanh</span> từ bạn nghe đúng và{" "}
          <span className="font-semibold text-rose-600">đỏ</span> từ bị sót. Đây là cách nhanh nhất để luyện tai nghe: nối âm, âm cuối, dạng yếu.
          {accuracy !== null && (
            <p className="mt-2">
              Độ chính xác {recent.length} câu gần nhất: <b className="text-indigo-600">{accuracy}%</b>
            </p>
          )}
        </div>
        <div className="mt-4 flex gap-1">
          {LEVELS.map((l) => (
            <button key={l} onClick={() => setLevel(l)} className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${level === l ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
              {l}
            </button>
          ))}
        </div>
        <p className="muted mt-2">{pool.length} câu ở trình độ {level}</p>
        <button className="btn-primary mt-4 w-full py-3 text-base" disabled={!pool.length} onClick={start}>
          ▶ Bắt đầu {SESSION} câu
        </button>
      </div>
    );

  if (!it) {
    const c = scores.reduce((a, x) => a + x.correct, 0);
    const t = scores.reduce((a, x) => a + x.total, 0);
    return (
      <div>
        <PageHeader title="✍️ Nghe chép chính tả" back="/practice" />
        <DoneBanner>
          <div className="text-4xl font-bold text-indigo-600">{t ? Math.round((c / t) * 100) : 0}%</div>
          <div className="font-semibold">
            Nghe đúng {c}/{t} từ trong {scores.length} câu
          </div>
          <p className="muted">Câu chưa đúng đã được lưu vào 📒 Sổ lỗi sai.</p>
          <button className="btn-soft" onClick={start}>
            Thêm {SESSION} câu
          </button>
        </DoneBanner>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="✍️ Nghe chép chính tả" back="/practice" right={<span className="muted">{i + 1}/{session.length}</span>} />
      <ProgressBar value={i / session.length} className="mb-4" />
      <div className="card">
        <div className="flex gap-2">
          <button className="btn-primary flex-1 py-3" onClick={() => playNative(it.aid)}>
            ▶ Nghe
          </button>
          <button className="btn-soft py-3" onClick={() => playNative(it.aid, 0.75)}>
            🐢 Chậm
          </button>
        </div>
        <textarea
          className="input mt-3 min-h-24"
          placeholder="Gõ câu bạn nghe được…"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={!!result}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!result && typed.trim()) check();
            }
          }}
        />
        {!result ? (
          <button className="btn-primary mt-3 w-full" disabled={!typed.trim()} onClick={check}>
            Kiểm tra
          </button>
        ) : (
          <div className="mt-4">
            <div className="text-sm font-semibold text-slate-500">
              Đúng {result.correct}/{result.total} từ
            </div>
            <p className="mt-1 text-lg leading-relaxed">
              {result.words.map((w, k) => (
                <span key={k} className={w.ok ? "text-emerald-600" : "font-semibold text-rose-600 underline decoration-wavy"}>
                  {w.w}{" "}
                </span>
              ))}
            </p>
            {result.extra.length > 0 && <p className="text-sm text-slate-500">Từ thừa: {result.extra.join(", ")}</p>}
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="font-medium">{it.text}</p>
              {it.vi && <p className="text-sm text-slate-500">{it.vi}</p>}
              <Credit author={it.author} license={it.license} />
            </div>
            <button className="btn-primary mt-3 w-full" onClick={next}>
              {i + 1 < session.length ? "Câu tiếp →" : "Xem kết quả"}
            </button>
          </div>
        )}
      </div>
      <p className="muted mt-3 text-center">Mẹo: nghe 2–3 lần, gõ từng cụm, chú ý âm cuối (-s, -ed) và các từ ngắn (a, the, to, of).</p>
    </div>
  );
}
