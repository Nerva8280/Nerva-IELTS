"use client";
import { useEffect, useRef, useState } from "react";
import { getState } from "@/lib/store";
import { speak, stopSpeaking } from "@/lib/tts";
import { compareWords, listen, recognitionSupported } from "@/lib/speech";
import { IntonationLegend, IntonationText, ProgressBar, useRecorder } from "./ui";
import { MAIN_VOICES, VOICES, type VoiceId } from "@/lib/audio-key";

export interface ShadowSentence {
  en: string;
  marked?: string; // intonation marks, see IntonationText
  vi?: string;
  tip?: string;
}

const RATES = [0.6, 0.8, 1];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sentence-by-sentence shadowing: listen (slow/normal, loop), repeat aloud, get word-level
 * feedback from speech recognition, or record yourself and compare.
 */
export default function ShadowingPlayer({ sentences, onFinish }: { sentences: ShadowSentence[]; onFinish?: (avgScore: number | null) => void }) {
  const [i, setI] = useState(0);
  const [rate, setRate] = useState(0.8);
  const [voice, setVoice] = useState<VoiceId>(() => getState().settings.voice ?? "uk-f");
  const [showMarks, setShowMarks] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [auto, setAuto] = useState(false);
  const [hideText, setHideText] = useState(false);
  const [showVi, setShowVi] = useState(true);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof compareWords> | null>(null);
  const [heard, setHeard] = useState("");
  const [scores, setScores] = useState<Record<number, number>>({});
  const run = useRef(0);
  const rec = useRecorder();
  const s = sentences[i];

  useEffect(() => () => {
    run.current++;
    stopSpeaking();
  }, []);

  function go(n: number) {
    run.current++;
    stopSpeaking();
    setPlaying(false);
    setAuto(false);
    setResult(null);
    setHeard("");
    setI(Math.max(0, Math.min(sentences.length - 1, n)));
  }

  async function play(times = 1) {
    const my = ++run.current;
    setPlaying(true);
    for (let k = 0; k < times && run.current === my; k++) {
      await speak(s.en, { rate, voice });
      if (k < times - 1) await sleep(pauseFor(s.en, rate));
    }
    if (run.current === my) setPlaying(false);
  }

  // Hands-free: play each sentence, leave a gap to repeat it, move on.
  async function autoShadow() {
    const my = ++run.current;
    setAuto(true);
    setPlaying(true);
    for (let k = i; k < sentences.length && run.current === my; k++) {
      setI(k);
      setResult(null);
      for (let rep = 0; rep < 2 && run.current === my; rep++) {
        await speak(sentences[k].en, { rate, voice });
        await sleep(pauseFor(sentences[k].en, rate));
      }
    }
    if (run.current === my) {
      setAuto(false);
      setPlaying(false);
    }
  }

  function stop() {
    run.current++;
    stopSpeaking();
    setPlaying(false);
    setAuto(false);
  }

  async function check() {
    stop();
    setChecking(true);
    setResult(null);
    try {
      const said = await listen(getState().settings.accent).result;
      setHeard(said);
      const r = compareWords(s.en, said);
      setResult(r);
      setScores((x) => ({ ...x, [i]: Math.max(x[i] ?? 0, r.score) }));
    } catch {
      setHeard("");
      setResult({ words: [], score: 0 });
    }
    setChecking(false);
  }

  const scored = Object.values(scores);
  const avg = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
        <span>
          Câu {i + 1}/{sentences.length}
        </span>
        {avg !== null && <span>Điểm TB: {avg}%</span>}
      </div>
      <ProgressBar value={(i + 1) / sentences.length} className="mb-3" />
      <div className="mb-3 flex gap-1">
        {MAIN_VOICES.map((v) => (
          <button
            key={v}
            onClick={() => setVoice(v)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${voice === v ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
          >
            {VOICES[v].label}
          </button>
        ))}
      </div>

      <div className="card min-h-44">
        {hideText && !result ? (
          <button className="w-full py-8 text-center text-slate-400" onClick={() => setHideText(false)}>
            👀 Chế độ nghe chép: đoán câu rồi chạm để hiện
          </button>
        ) : result && result.words.length ? (
          <p className="text-xl leading-relaxed font-semibold">
            {result.words.map((w, k) => (
              <span key={k} className={w.ok ? "text-emerald-600" : "text-rose-500 underline decoration-wavy"}>
                {w.w}{" "}
              </span>
            ))}
          </p>
        ) : (
          s.marked && showMarks ? (
            <IntonationText en={s.en} marked={s.marked} className="text-xl font-semibold text-slate-900" />
          ) : (
            <p className="text-xl leading-relaxed font-semibold text-slate-900">{s.en}</p>
          )
        )}
        {s.marked && showMarks && !result && (
          <div className="mt-2">
            <IntonationLegend />
          </div>
        )}
        {showVi && s.vi && <p className="mt-2 text-slate-500">{s.vi}</p>}
        {s.tip && <p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-sm text-amber-800">💡 {s.tip}</p>}
        {result && (
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
            {result.words.length ? (
              <>
                <div className="font-semibold">
                  Độ khớp: <span className={result.score >= 80 ? "text-emerald-600" : result.score >= 50 ? "text-amber-600" : "text-rose-600"}>{result.score}%</span>
                  {result.score >= 90 ? " 🎉 Tuyệt vời!" : result.score >= 70 ? " Khá tốt!" : " Nghe lại và thử lần nữa."}
                </div>
                <div className="mt-1 text-slate-500">Máy nghe được: “{heard}”</div>
              </>
            ) : (
              <span className="text-slate-500">Không nghe được giọng của bạn. Kiểm tra quyền micro và thử lại.</span>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {playing ? (
          <button className="btn-primary col-span-2 py-3" onClick={stop}>
            ⏸ Dừng
          </button>
        ) : (
          <>
            <button className="btn-primary py-3" onClick={() => play(1)}>
              ▶ Nghe
            </button>
            <button className="btn-soft py-3" onClick={() => play(3)}>
              🔁 Nghe 3 lần
            </button>
          </>
        )}
        <div className="flex rounded-xl bg-white ring-1 ring-slate-200">
          {RATES.map((r) => (
            <button key={r} onClick={() => setRate(r)} className={`flex-1 rounded-xl text-xs font-semibold ${rate === r ? "bg-indigo-600 text-white" : "text-slate-600"}`}>
              {r}×
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {recognitionSupported() && (
          <button className={checking ? "btn bg-rose-600 py-3 text-white" : "btn-ghost py-3"} onClick={check} disabled={checking}>
            {checking ? "🎙 Đang nghe… hãy nói" : "🎙 Nói theo & chấm"}
          </button>
        )}
        {rec.recording ? (
          <button className="btn bg-rose-600 py-3 text-white" onClick={rec.stop}>
            ⏹ Dừng ghi
          </button>
        ) : (
          <button className="btn-ghost py-3" onClick={() => void rec.start()}>
            🎤 Ghi âm so sánh
          </button>
        )}
      </div>
      {rec.error && <p className="mt-2 text-sm text-rose-600">{rec.error}</p>}
      {rec.url && !rec.recording && (
        <div className="mt-2 flex items-center gap-2">
          <audio controls src={rec.url} className="flex-1" />
          <button className="btn-soft" onClick={() => play(1)}>
            Mẫu
          </button>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button className="btn-ghost" onClick={() => go(i - 1)} disabled={i === 0}>
          ← Trước
        </button>
        <button className="btn-ghost flex-1" onClick={() => (auto ? stop() : autoShadow())}>
          {auto ? "⏹ Dừng tự động" : "🎧 Shadowing liên tục"}
        </button>
        {i < sentences.length - 1 ? (
          <button className="btn-primary" onClick={() => go(i + 1)}>
            Tiếp →
          </button>
        ) : (
          <button className="btn-primary" onClick={() => onFinish?.(avg)}>
            Xong ✓
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showVi} onChange={(e) => setShowVi(e.target.checked)} /> Hiện nghĩa tiếng Việt
        </label>
        {sentences.some((x) => x.marked) && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showMarks} onChange={(e) => setShowMarks(e.target.checked)} /> Hiện ngữ điệu
          </label>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={hideText} onChange={(e) => setHideText(e.target.checked)} /> Ẩn câu (luyện nghe)
        </label>
      </div>
    </div>
  );
}

/** Gap long enough to repeat the sentence aloud. */
function pauseFor(text: string, rate: number) {
  const words = text.split(/\s+/).length;
  return Math.round((words * 420) / rate + 900);
}

export function splitSentences(text: string): ShadowSentence[] {
  return (text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [])
    .map((x) => x.trim())
    .filter((x) => x.split(" ").length >= 2)
    .map((en) => ({ en }));
}
