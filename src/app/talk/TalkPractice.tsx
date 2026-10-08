"use client";
import { useEffect, useRef, useState } from "react";
import type { TalkGrade } from "@/lib/grader";
import { getState, markDone, update, useAppState } from "@/lib/store";
import { todayStr } from "@/lib/dates";
import { speak, speakVocab, stopSpeaking } from "@/lib/tts";
import { useVocab } from "@/lib/vocab-client";
import { useAuth } from "@/components/AppShell";
import ShadowingPlayer, { splitSentences } from "@/components/ShadowingPlayer";
import { PageHeader, ProgressBar, SpeakButton, fmtTime, useRecorder, useTimer } from "@/components/ui";
import type { ActiveQuestion } from "./TalkHome";

type Phase = "ready" | "asking" | "thinking" | "recording" | "grading" | "result" | "error";

const THINK_SEC = 5;
const CRITERIA: [keyof TalkGrade["feedback"], string][] = [
  ["fluency", "Trôi chảy & mạch lạc"],
  ["lexical", "Từ vựng"],
  ["grammar", "Ngữ pháp"],
  ["pronunciation", "Phát âm"],
];

/** Learner's studied words (still-learning first) to send to the grader. */
function useLearnedWords(): string[] {
  const vocab = useVocab();
  const s = useAppState();
  if (!vocab) return [];
  const byId = new Map(vocab.map((w) => [w.id, w.word]));
  const ids = Object.entries(s.srs).sort((a, b) => Number(!!a[1].known) - Number(!!b[1].known));
  return ids.map(([id]) => byId.get(id)).filter((w): w is string => !!w).slice(0, 200);
}

export default function TalkPractice({ active, onBack, onNext }: { active: ActiveQuestion; onBack: () => void; onNext: (next?: ActiveQuestion) => void }) {
  const { me } = useAuth();
  const s = useAppState();
  const words = useLearnedWords();
  const rec = useRecorder();
  const [phase, setPhase] = useState<Phase>("ready");
  const [reflex, setReflex] = useState(true);
  const [listenOnly, setListenOnly] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [thinkLeft, setThinkLeft] = useState(THINK_SEC);
  const [sec, setSec] = useTimer(phase === "recording");
  const [grade, setGrade] = useState<TalkGrade | null>(null);
  const [error, setError] = useState("");
  const [shadow, setShadow] = useState(false);
  const run = useRef(0);
  const maxSec = active.part === 3 ? 90 : 45;
  const { recording, stop, blob } = rec;

  useEffect(() => () => {
    run.current++;
    stopSpeaking();
  }, []);

  // stop automatically at the time limit
  useEffect(() => {
    if (recording && sec >= maxSec) stop();
  }, [recording, sec, maxSec, stop]);

  // when the recorder hands over the audio, send it for grading
  useEffect(() => {
    if (phase === "recording" && !recording && blob) void submit(blob);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, blob]);

  async function startRecording() {
    rec.reset();
    setSec(0);
    await rec.start();
    setPhase("recording");
  }

  async function begin() {
    const my = ++run.current;
    setGrade(null);
    setError("");
    setPhase("asking");
    await speak(active.q, { voice: "uk-f" });
    if (my !== run.current) return;
    if (!reflex) return setPhase("thinking");
    setPhase("thinking");
    for (let t = THINK_SEC; t > 0; t--) {
      setThinkLeft(t);
      await new Promise((r) => setTimeout(r, 1000));
      if (my !== run.current) return;
    }
    await startRecording();
  }

  async function submit(audio: Blob) {
    setPhase("grading");
    const form = new FormData();
    form.append("audio", audio, "answer");
    form.append("question", active.q);
    form.append("part", String(active.part));
    form.append("level", getState().level);
    form.append("words", words.join(","));
    try {
      const res = await fetch("/api/talk/grade", { method: "POST", body: form });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Lỗi máy chủ");
      const g = j as TalkGrade;
      setGrade(g);
      setPhase("result");
      if (g.bands.overall > 0)
        update((st) => {
          st.talks = [...(st.talks ?? []), { date: todayStr(), topic: active.topic.id, qid: active.qid, q: active.q, bands: g.bands }].slice(-300);
        });
      if (active.qid && g.bands.overall > 0) markDone(active.qid, Math.round(g.bands.overall * 10), 90);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  const header = <PageHeader title={`${active.topic.icon} ${active.topic.topicVi}`} right={<button className="btn-ghost px-3 py-1.5" onClick={onBack}>Danh sách</button>} />;

  if (!me?.user)
    return (
      <div>
        {header}
        <div className="card text-center text-slate-600">Tính năng chấm bài nói cần đăng nhập Google (Cài đặt → Thoát → Đăng nhập bằng Google).</div>
      </div>
    );

  if (phase === "result" && grade) return <Result grade={grade} active={active} audioUrl={rec.url} header={header} shadow={shadow} setShadow={setShadow} onRetry={() => setPhase("ready")} onNext={onNext} />;

  return (
    <div>
      {header}
      <div className="card text-center">
        <div className="mb-2 text-xs font-semibold text-slate-400">PART {active.part} {active.qid ? "" : "· CÂU HỎI TIẾP"}</div>
        {listenOnly && phase !== "result" ? (
          <p className="text-lg text-slate-400">🎧 Chế độ chỉ nghe, câu hỏi được ẩn</p>
        ) : (
          <p className="text-xl font-semibold leading-relaxed text-slate-900">{active.q}</p>
        )}
        <div className="mt-3 flex justify-center gap-2">
          <SpeakButton text={active.q} voice="uk-f" label="Nghe lại" />
          {active.hintVi && (
            <button className="rounded-full bg-amber-50 px-2.5 py-1 text-sm text-amber-800" onClick={() => setShowHint((x) => !x)}>
              💡 Gợi ý
            </button>
          )}
        </div>
        {showHint && active.hintVi && <p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-left text-sm text-amber-800">{active.hintVi}</p>}
      </div>

      <div className="card mt-4 text-center">
        {phase === "ready" && (
          <>
            <button className="btn-primary w-full py-4 text-base" onClick={begin}>
              ▶ Bắt đầu
            </button>
            <p className="muted mt-2">
              {reflex ? `Nghe câu hỏi → ${THINK_SEC} giây suy nghĩ → tự động ghi âm (tối đa ${maxSec} giây).` : "Nghe câu hỏi, rồi tự bấm ghi âm khi sẵn sàng."}
            </p>
          </>
        )}
        {phase === "asking" && <div className="py-4 text-lg font-semibold text-indigo-600">🔊 Giám khảo đang hỏi…</div>}
        {phase === "thinking" &&
          (reflex ? (
            <div className="py-2">
              <div className="text-5xl font-bold text-indigo-600">{thinkLeft}</div>
              <div className="muted">Chuẩn bị trả lời…</div>
              <button className="btn-soft mt-3" onClick={() => (run.current++, startRecording())}>
                Nói luôn
              </button>
            </div>
          ) : (
            <button className="btn-primary w-full py-4 text-base" onClick={startRecording}>
              🎙 Bắt đầu trả lời
            </button>
          ))}
        {phase === "recording" && (
          <div>
            <div className="flex items-center justify-center gap-2 text-lg font-semibold text-rose-600">
              <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-rose-600" /> Đang ghi âm {fmtTime(sec)} / {fmtTime(maxSec)}
            </div>
            <ProgressBar value={sec / maxSec} className="mt-3" />
            <button className="btn mt-4 w-full bg-rose-600 py-4 text-base text-white" onClick={stop}>
              ⏹ Trả lời xong, chấm điểm
            </button>
          </div>
        )}
        {phase === "grading" && (
          <div className="py-4">
            <div className="text-lg font-semibold text-indigo-600">🤖 AI đang nghe và chấm bài…</div>
            <div className="muted mt-1">Thường mất 10–30 giây</div>
          </div>
        )}
        {phase === "error" && (
          <div>
            <p className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
            <div className="flex gap-2">
              {blob && (
                <button className="btn-soft flex-1" onClick={() => submit(blob)}>
                  Gửi chấm lại
                </button>
              )}
              <button className="btn-ghost flex-1" onClick={() => setPhase("ready")}>
                Ghi âm lại
              </button>
            </div>
          </div>
        )}
        {rec.error && <p className="mt-2 text-sm text-rose-600">{rec.error}</p>}
      </div>

      {phase === "ready" && (
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={reflex} onChange={(e) => setReflex(e.target.checked)} /> Phản xạ nhanh (tự ghi âm sau {THINK_SEC}s)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={listenOnly} onChange={(e) => setListenOnly(e.target.checked)} /> Chỉ nghe, ẩn chữ câu hỏi
          </label>
        </div>
      )}
      {(s.talks?.length ?? 0) === 0 && phase === "ready" && (
        <p className="muted mt-4">Mẹo: trả lời 2–4 câu cho Part 1, 5–7 câu cho Part 3. Nói tự nhiên như đang trò chuyện, đừng đọc thuộc lòng.</p>
      )}
    </div>
  );
}

function bandColor(b: number) {
  return b >= 7 ? "text-emerald-600" : b >= 5.5 ? "text-indigo-600" : b >= 4 ? "text-amber-600" : "text-rose-600";
}

function Result({
  grade,
  active,
  audioUrl,
  header,
  shadow,
  setShadow,
  onRetry,
  onNext,
}: {
  grade: TalkGrade;
  active: ActiveQuestion;
  audioUrl: string | null;
  header: React.ReactNode;
  shadow: boolean;
  setShadow: (x: boolean) => void;
  onRetry: () => void;
  onNext: (next?: ActiveQuestion) => void;
}) {
  const b = grade.bands;
  return (
    <div>
      {header}
      <div className="card text-center">
        <div className="muted">Band ước tính</div>
        <div className={`text-5xl font-bold ${bandColor(b.overall)}`}>{b.overall.toFixed(1)}</div>
        <p className="mt-2 text-slate-600">{grade.encouragementVi}</p>
        {!grade.answeredQuestion && <p className="mt-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-800">⚠️ Câu trả lời chưa đúng trọng tâm câu hỏi.</p>}
      </div>

      <div className="card mt-4 space-y-4">
        {CRITERIA.map(([k, name]) => (
          <div key={k}>
            <div className="mb-1 flex justify-between text-sm font-semibold">
              <span>{name}</span>
              <span className={bandColor(b[k])}>{b[k].toFixed(1)}</span>
            </div>
            <ProgressBar value={b[k] / 9} />
            <p className="mt-1.5 text-sm text-slate-600">{grade.feedback[k]}</p>
          </div>
        ))}
      </div>

      <div className="card mt-4">
        <div className="h2 mb-2">Bạn đã nói</div>
        <p className="italic leading-relaxed text-slate-700">“{grade.transcript || "…"}”</p>
        {audioUrl && <audio controls src={audioUrl} className="mt-3 w-full" />}
      </div>

      {grade.corrections.length > 0 && (
        <div className="card mt-4">
          <div className="h2 mb-2">Sửa lỗi</div>
          <div className="space-y-3">
            {grade.corrections.map((c, i) => (
              <div key={i} className="text-sm">
                <div className="text-rose-600 line-through">{c.original}</div>
                <div className="font-semibold text-emerald-700">→ {c.corrected}</div>
                <div className="text-slate-500">{c.explanationVi}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {grade.pronunciationIssues.length > 0 && (
        <div className="card mt-4">
          <div className="h2 mb-2">Phát âm cần sửa</div>
          <div className="space-y-2">
            {grade.pronunciationIssues.map((p, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <button className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700" onClick={() => speakVocab(p.word)} aria-label="Nghe">
                  🔊
                </button>
                <div>
                  <b>{p.word}</b>: {p.issueVi}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mt-4">
        <div className="h2 mb-2">Từ vựng</div>
        {grade.learnedWordsUsed.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-1.5">
            <span className="text-sm text-slate-500">Từ đã học bạn dùng được:</span>
            {grade.learnedWordsUsed.map((w) => (
              <span key={w} className="chip bg-emerald-100 text-emerald-700">
                ✓ {w}
              </span>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-sm text-slate-500">Lần này bạn chưa dùng từ nào trong danh sách đã học. Thử áp dụng các từ dưới đây nhé!</p>
        )}
        <div className="space-y-2">
          {grade.suggestedWords.map((w, i) => (
            <div key={i} className="text-sm">
              <b className="text-indigo-700">{w.word}</b>: {w.howVi}
            </div>
          ))}
        </div>
      </div>

      <div className="card mt-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="h2">Câu trả lời gợi ý</div>
          <SpeakButton text={grade.improvedAnswer} label="Nghe" />
        </div>
        <p className="leading-relaxed">{grade.improvedAnswer}</p>
        <button className="btn-soft mt-3 w-full" onClick={() => setShadow(!shadow)}>
          {shadow ? "Đóng" : "🎧 Shadowing câu trả lời này"}
        </button>
        {shadow && (
          <div className="mt-3">
            <ShadowingPlayer sentences={splitSentences(grade.improvedAnswer)} onFinish={() => setShadow(false)} />
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {grade.followUp && (
          <button
            className="btn-primary w-full py-3"
            onClick={() => onNext({ topic: active.topic, q: grade.followUp, part: active.part })}
          >
            💬 Trả lời câu hỏi tiếp: “{grade.followUp.length > 60 ? grade.followUp.slice(0, 60) + "…" : grade.followUp}”
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost" onClick={onRetry}>
            ↻ Trả lời lại
          </button>
          <button className="btn-ghost" onClick={() => onNext()}>
            🎲 Câu khác
          </button>
        </div>
      </div>
      <p className="muted mt-4 text-center text-xs">Điểm do AI ước tính để luyện tập, có thể lệch ±0.5–1 band so với giám khảo thật.</p>
    </div>
  );
}
