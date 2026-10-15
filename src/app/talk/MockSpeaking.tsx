"use client";
import { useEffect, useRef, useState } from "react";
import type { TalkTopic } from "@/content/types";
import type { TalkGrade } from "@/lib/grader";
import { getState, update } from "@/lib/store";
import { todayStr } from "@/lib/dates";
import { addMistakes } from "@/lib/notebook";
import AiQuota, { notifyGraded } from "@/components/AiQuota";
import { speak, stopSpeaking } from "@/lib/tts";
import { useLearnedWords } from "@/lib/vocab-client";
import { useAuth } from "@/components/AppShell";
import { BandBars, Corrections, bandColor } from "@/components/feedback";
import { PageHeader, ProgressBar, fmtTime, useRecorder, useTimer } from "@/components/ui";
import type { CueCard } from "./TalkHome";

interface Step {
  part: 1 | 2 | 3;
  q: string;
  cueCard?: string[];
}
type Graded = { step: Step; grade?: TalkGrade; error?: string };

const MAX: Record<1 | 2 | 3, number> = { 1: 45, 2: 120, 3: 90 };
const pickN = <T,>(xs: T[], n: number) => [...xs].sort(() => Math.random() - 0.5).slice(0, n);

function buildTest(topics: TalkTopic[], cards: CueCard[]): { steps: Step[]; topicVi: string } {
  const t = topics[Math.floor(Math.random() * topics.length)];
  const card = cards[Math.floor(Math.random() * cards.length)];
  const part1 = t.questions.filter((q) => q.part === 1).slice(0, 6);
  const p1 = pickN(part1, 4).sort((a, b) => part1.indexOf(a) - part1.indexOf(b));
  const p3 = card.part3.slice(0, 3);
  return {
    topicVi: t.topicVi,
    steps: [
      ...p1.map((q) => ({ part: 1 as const, q: q.q })),
      { part: 2 as const, q: card.title, cueCard: card.points },
      ...p3.map((q) => ({ part: 3 as const, q })),
    ],
  };
}

async function gradeAudio(blob: Blob, step: Step, words: string[]): Promise<TalkGrade> {
  const form = new FormData();
  form.append("audio", blob, "answer");
  form.append("question", step.cueCard ? `${step.q}\nCue card: ${step.cueCard.join("; ")}` : step.q);
  form.append("part", String(step.part));
  form.append("level", getState().level);
  form.append("words", words.join(","));
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("/api/talk/grade", { method: "POST", body: form });
    notifyGraded();
    const j = await res.json().catch(() => ({}));
    if (res.ok) return j as TalkGrade;
    if (j.quota) throw new Error(j.error); // out of free gradings: waiting will not help
    if (res.status !== 429 && res.status < 500) throw new Error(j.error ?? "Lỗi máy chủ");
    await new Promise((r) => setTimeout(r, 4000)); // overloaded: wait and try once more
  }
  throw new Error("AI đang quá tải, câu này chưa chấm được.");
}

export default function MockSpeaking({ topics, cards, onExit }: { topics: TalkTopic[]; cards: CueCard[]; onExit: () => void }) {
  const { me } = useAuth();
  const words = useLearnedWords();
  const rec = useRecorder();
  const [test] = useState(() => buildTest(topics, cards));
  const [phase, setPhase] = useState<"intro" | "asking" | "prep" | "recording" | "finishing" | "report">("intro");
  const [i, setI] = useState(0);
  const [prepLeft, setPrepLeft] = useState(60);
  const [notes, setNotes] = useState("");
  const [sec, setSec] = useTimer(phase === "recording");
  const [results, setResults] = useState<Graded[]>([]);
  const pending = useRef<Promise<void>[]>([]);
  const run = useRef(0);
  const step = test.steps[i];
  const { recording, stop, blob } = rec;

  useEffect(() => () => {
    run.current++;
    stopSpeaking();
  }, []);

  useEffect(() => {
    if (recording && sec >= MAX[step.part]) stop();
  }, [recording, sec, step.part, stop]);

  // an answer was recorded: grade it in the background and move to the next question
  useEffect(() => {
    if (phase === "recording" && !recording && blob) handleAnswer(blob);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, blob]);

  function handleAnswer(audio: Blob) {
    const idx = i;
    const st = step;
    setResults((r) => Object.assign([...r], { [idx]: { step: st } }));
    pending.current.push(
      gradeAudio(audio, st, words)
        .then((grade) => setResults((r) => Object.assign([...r], { [idx]: { step: st, grade } })))
        .catch((e) => setResults((r) => Object.assign([...r], { [idx]: { step: st, error: (e as Error).message } }))),
    );
    if (idx + 1 < test.steps.length) {
      setI(idx + 1);
      void ask(idx + 1);
    } else void finish();
  }

  async function startRecording() {
    rec.reset();
    setSec(0);
    await rec.start();
    setPhase("recording");
  }

  async function ask(idx: number) {
    const my = ++run.current;
    const st = test.steps[idx];
    setPhase("asking");
    await speak(st.q, { voice: "uk-f" });
    if (my !== run.current) return;
    if (st.part === 2) {
      setNotes("");
      setPhase("prep");
      for (let t = 60; t > 0; t--) {
        setPrepLeft(t);
        await new Promise((r) => setTimeout(r, 1000));
        if (my !== run.current) return;
      }
    } else await new Promise((r) => setTimeout(r, 1500));
    if (my !== run.current) return;
    await startRecording();
  }

  async function finish() {
    setPhase("finishing");
    await Promise.all(pending.current);
    setPhase("report");
  }

  // save once the report is ready
  const saved = useRef(false);
  useEffect(() => {
    if (phase !== "report" || saved.current) return;
    saved.current = true;
    const graded = results.filter((r) => r?.grade && r.grade.bands.overall > 0).map((r) => r.grade!);
    if (!graded.length) return;
    const mean = (k: "fluency" | "lexical" | "grammar" | "pronunciation") => Math.round((graded.reduce((a, g) => a + g.bands[k], 0) / graded.length) * 2) / 2;
    const b = { fluency: mean("fluency"), lexical: mean("lexical"), grammar: mean("grammar"), pronunciation: mean("pronunciation") };
    const overall = Math.floor(((b.fluency + b.lexical + b.grammar + b.pronunciation) / 4) * 2 + 0.5 + 1e-9) / 2;
    update((st) => void (st.talks = [...(st.talks ?? []), { date: todayStr(), topic: "mock", q: "Thi thử Speaking", bands: { ...b, overall } }].slice(-300)));
    addMistakes(
      graded.flatMap((g) => [
        ...g.corrections.map((c) => ({ source: "Thi thử Speaking", kind: "grammar" as const, original: c.original, corrected: c.corrected, explanationVi: c.explanationVi })),
        ...g.pronunciationIssues.map((p) => ({ source: "Thi thử Speaking", kind: "pronunciation" as const, original: p.word, corrected: p.word, explanationVi: p.issueVi })),
      ]),
    );
  }, [phase, results]);

  const header = (
    <PageHeader
      title="🎤 Thi thử Speaking"
      right={
        <button
          className="btn-ghost px-3 py-1.5"
          onClick={() => {
            run.current++;
            stopSpeaking();
            stop();
            onExit();
          }}
        >
          Thoát
        </button>
      }
    />
  );

  if (!me?.user)
    return (
      <div>
        {header}
        <div className="card text-center text-slate-600">Thi thử có AI chấm cần đăng nhập Google.</div>
      </div>
    );

  if (phase === "intro")
    return (
      <div>
        {header}
        <div className="card space-y-2 text-sm leading-relaxed">
          <p>
            Bài thi gồm <b>{test.steps.length} câu</b>, chạy liên tục như phòng thi thật (khoảng 12 phút):
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>Part 1</b> ({test.steps.filter((s) => s.part === 1).length} câu): chủ đề <i>{test.topicVi}</i>, mỗi câu tối đa 45 giây.
            </li>
            <li>
              <b>Part 2</b>: 1 thẻ đề, 1 phút chuẩn bị (có ô ghi chú), nói 1–2 phút.
            </li>
            <li>
              <b>Part 3</b> ({test.steps.filter((s) => s.part === 3).length} câu): thảo luận sâu, mỗi câu tối đa 90 giây.
            </li>
          </ul>
          <p className="text-slate-500">Giám khảo đọc câu hỏi, sau 1–2 giây máy tự ghi âm. Nói xong mỗi câu, bấm “Câu tiếp theo”. Tìm chỗ yên tĩnh và đeo tai nghe nếu có.</p>
          <p className="text-slate-500">Mỗi câu dùng 1 lượt AI chấm, cả bài dùng {test.steps.length} lượt.</p>
          <AiQuota />
        </div>
        <button
          className="btn-primary mt-4 w-full py-4 text-base"
          onClick={() => {
            setI(0);
            void ask(0);
          }}
        >
          ▶ Bắt đầu thi
        </button>
      </div>
    );

  if (phase === "finishing")
    return (
      <div>
        {header}
        <div className="card py-8 text-center">
          <div className="text-lg font-semibold text-indigo-600">🤖 AI đang chấm các câu còn lại…</div>
          <div className="muted mt-1">
            Đã chấm {results.filter((r) => r?.grade || r?.error).length}/{test.steps.length} câu
          </div>
        </div>
      </div>
    );

  if (phase === "report") return <Report results={results} onExit={onExit} header={header} />;

  return (
    <div>
      {header}
      <div className="mb-2 flex justify-between text-sm text-slate-500">
        <span>
          Part {step.part} · Câu {i + 1}/{test.steps.length}
        </span>
      </div>
      <ProgressBar value={i / test.steps.length} className="mb-3" />
      <div className="card text-center">
        <p className="text-xl font-semibold leading-relaxed">{step.q}</p>
        {step.cueCard && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-left text-slate-700">
            {step.cueCard.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="card mt-4 text-center">
        {phase === "asking" && <div className="py-3 text-lg font-semibold text-indigo-600">🔊 Giám khảo đang hỏi…</div>}
        {phase === "prep" && (
          <div>
            <div className="text-5xl font-bold text-indigo-600">{prepLeft}</div>
            <div className="muted">giây chuẩn bị</div>
            <textarea className="input mt-3 min-h-24 text-left text-sm" placeholder="Ghi nhanh từ khóa cho từng ý…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button className="btn-soft mt-2" onClick={() => (run.current++, startRecording())}>
              Bắt đầu nói luôn
            </button>
          </div>
        )}
        {phase === "recording" && (
          <div>
            <div className="flex items-center justify-center gap-2 text-lg font-semibold text-rose-600">
              <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-rose-600" /> {fmtTime(sec)} / {fmtTime(MAX[step.part])}
            </div>
            <ProgressBar value={sec / MAX[step.part]} className="mt-3" />
            {step.part === 2 && sec < 60 && <div className="muted mt-1">Cố gắng nói ít nhất 1 phút ({60 - sec}s nữa)</div>}
            {step.part === 2 && notes && <p className="mt-2 whitespace-pre-line rounded-xl bg-slate-50 p-2 text-left text-sm text-slate-600">{notes}</p>}
            <button className="btn mt-4 w-full bg-rose-600 py-4 text-base text-white" onClick={stop}>
              {i + 1 < test.steps.length ? "⏭ Câu tiếp theo" : "✓ Kết thúc bài thi"}
            </button>
          </div>
        )}
        {rec.error && <p className="mt-2 text-sm text-rose-600">{rec.error}</p>}
      </div>
    </div>
  );
}

function Report({ results, onExit, header }: { results: Graded[]; onExit: () => void; header: React.ReactNode }) {
  const [open, setOpen] = useState<number | null>(null);
  const graded = results.filter((r) => r?.grade && r.grade.bands.overall > 0);
  if (!graded.length)
    return (
      <div>
        {header}
        <div className="card text-center text-slate-600">Chưa chấm được câu nào. Kiểm tra micro và mạng, rồi thử lại.</div>
        <button className="btn-primary mt-4 w-full" onClick={onExit}>
          Quay lại
        </button>
      </div>
    );
  const mean = (k: "fluency" | "lexical" | "grammar" | "pronunciation") => Math.round((graded.reduce((a, r) => a + r.grade!.bands[k], 0) / graded.length) * 2) / 2;
  const b = { fluency: mean("fluency"), lexical: mean("lexical"), grammar: mean("grammar"), pronunciation: mean("pronunciation") };
  const overall = Math.floor(((b.fluency + b.lexical + b.grammar + b.pronunciation) / 4) * 2 + 0.5 + 1e-9) / 2;
  // the Part 2 long turn shows the most, so its feedback is used for the summary
  const main = (graded.find((r) => r.step.part === 2) ?? graded[0]).grade!;
  return (
    <div>
      {header}
      <div className="card text-center">
        <div className="muted">Band Speaking ước tính</div>
        <div className={`text-5xl font-bold ${bandColor(overall)}`}>{overall.toFixed(1)}</div>
        <p className="muted mt-1">
          Trung bình {graded.length}/{results.length} câu đã chấm
        </p>
      </div>
      <BandBars
        items={[
          { name: "Trôi chảy & mạch lạc", band: b.fluency, text: main.feedback.fluency },
          { name: "Từ vựng", band: b.lexical, text: main.feedback.lexical },
          { name: "Ngữ pháp", band: b.grammar, text: main.feedback.grammar },
          { name: "Phát âm", band: b.pronunciation, text: main.feedback.pronunciation },
        ]}
      />
      <div className="card mt-4">
        <div className="h2 mb-2">Từng câu</div>
        <div className="divide-y divide-slate-100">
          {results.map((r, k) => (
            <div key={k} className="py-2.5">
              <button className="flex w-full items-start gap-2 text-left" onClick={() => setOpen(open === k ? null : k)}>
                <span className="chip shrink-0 bg-slate-100 text-slate-600">P{r.step.part}</span>
                <span className="flex-1 text-sm">{r.step.q}</span>
                {r.grade ? <b className={bandColor(r.grade.bands.overall)}>{r.grade.bands.overall.toFixed(1)}</b> : <span className="text-xs text-rose-500">lỗi</span>}
              </button>
              {open === k && r.grade && (
                <div className="mt-2 space-y-1 text-sm">
                  <p className="italic text-slate-600">“{r.grade.transcript}”</p>
                  <Corrections items={r.grade.corrections} />
                  <p className="text-slate-500">Gợi ý: {r.grade.improvedAnswer}</p>
                </div>
              )}
              {open === k && r.error && <p className="mt-1 text-sm text-rose-600">{r.error}</p>}
            </div>
          ))}
        </div>
      </div>
      <button className="btn-primary mt-4 w-full" onClick={onExit}>
        Xong
      </button>
      <p className="muted mt-2 text-center text-xs">Điểm do AI ước tính để luyện tập, có thể lệch ±0.5–1 band so với giám khảo thật. Các lỗi đã được lưu vào Sổ lỗi sai.</p>
    </div>
  );
}
