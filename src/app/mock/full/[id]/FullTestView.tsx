"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { FullTest, ListeningItem, Question } from "@/content/types";
import { getState, update } from "@/lib/store";
import { todayStr } from "@/lib/dates";
import { rawToBand } from "@/lib/progress";
import { speak, stopSpeaking } from "@/lib/tts";
import { scriptVoices } from "@/lib/audio-key";
import QuestionSet, { saveMistakes, scoreOf, type Answer } from "@/components/QuestionSet";
import { PageHeader, fmtTime } from "@/components/ui";
import { Passage } from "@/app/reading/[id]/ReadingView";

const READING_SEC = 60 * 60;
const PART_GAP = 10; // seconds between listening parts to read the next questions

type Mode = "both" | "listening" | "reading";
interface Draft {
  step: "listening" | "reading" | "result";
  mode: Mode;
  l: Answer[][]; // answers per listening part
  r: Answer[][]; // answers per reading passage
  pos: { part: number; line: number }; // listening playback position (part = parts.length when finished)
  endsAt?: number; // reading deadline, ms
  usedSec?: number;
}

const storageKey = (id: string) => `ielts-mock-${id}`;
const noSubscribe = () => () => {};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const roundHalf = (x: number) => Math.floor(x * 2 + 0.5) / 2;
const answered = (a: Answer) => a !== undefined && a !== "" && !(Array.isArray(a) && !a.length);

/** First question number of each set: exam sections number questions continuously. */
function starts(sets: { questions: Question[] }[]) {
  const out: number[] = [];
  let n = 1;
  for (const s of sets) {
    out.push(n);
    n += s.questions.length;
  }
  return out;
}

function sectionScore(sets: { questions: Question[] }[], answers: Answer[][]) {
  const per = sets.map((s, i) => scoreOf(s.questions, answers[i] ?? []));
  return { per, score: per.reduce((a, b) => a + b, 0), total: sets.reduce((a, s) => a + s.questions.length, 0) };
}

/** Plays the four parts once, in order, like the exam recording. Pausing is allowed; rewinding is not. */
function ExamAudio({ parts, pos, onPos }: { parts: ListeningItem[]; pos: Draft["pos"]; onPos: (p: Draft["pos"]) => void }) {
  const [playing, setPlaying] = useState(false);
  const [wait, setWait] = useState(0);
  const run = useRef(0);
  const voices = useMemo(() => parts.map((p) => scriptVoices(p.script)), [parts]);
  const lines = parts.reduce((a, p) => a + p.script.length, 0);
  const heard = parts.slice(0, pos.part).reduce((a, p) => a + p.script.length, 0) + pos.line;

  useEffect(
    () => () => {
      run.current++;
      stopSpeaking();
    },
    [],
  );

  async function play() {
    const my = ++run.current;
    setPlaying(true);
    let { part, line } = pos;
    while (part < parts.length) {
      const p = parts[part];
      if (line === 0 && part > 0)
        for (let s = PART_GAP; s > 0; s--) {
          if (run.current !== my) return;
          setWait(s);
          await sleep(1000);
        }
      setWait(0);
      for (; line < p.script.length; line++) {
        if (run.current !== my) return;
        onPos({ part, line });
        await speak(p.script[line].text, { voice: voices[part][line], gender: p.script[line].gender, rate: 1, absoluteRate: true });
        if (run.current !== my) return; // paused: this line is replayed on resume
        await sleep(400);
      }
      part++;
      line = 0;
      onPos({ part, line });
    }
    setPlaying(false);
  }

  function pause() {
    run.current++;
    stopSpeaking();
    setPlaying(false);
    setWait(0);
  }

  if (pos.part >= parts.length) return <div className="card text-sm font-semibold text-emerald-700">✓ Đã nghe hết 4 part. Kiểm tra lại câu trả lời rồi nộp bài.</div>;
  return (
    <div className="card">
      <button className="btn-primary w-full py-3" onClick={playing ? pause : play}>
        {playing ? "⏸ Tạm dừng" : heard ? "▶ Nghe tiếp" : "▶ Bắt đầu nghe"}
      </button>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${(heard / lines) * 100}%` }} />
      </div>
      <div className="muted mt-2 text-sm">
        {wait ? `Part ${pos.part + 1} bắt đầu sau ${wait} giây, hãy đọc trước câu hỏi.` : `Part ${pos.part + 1} · đoạn ${pos.line + 1}/${parts[pos.part].script.length}`}
      </div>
    </div>
  );
}

function Tabs({ labels, value, onChange, right }: { labels: string[]; value: number; onChange: (i: number) => void; right?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 mb-3 flex items-center gap-1.5 bg-slate-50/95 px-4 py-2 backdrop-blur">
      {labels.map((l, i) => (
        <button
          key={i}
          onClick={() => {
            onChange(i);
            window.scrollTo({ top: 0 });
          }}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${value === i ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
        >
          {l}
        </button>
      ))}
      <div className="flex-1" />
      {right}
    </div>
  );
}

export default function FullTestView({ test }: { test: FullTest }) {
  const L = test.listening?.parts ?? [];
  const R = test.reading;
  const lStart = starts(L);
  const rStart = starts(R);
  const saved = useSyncExternalStore(noSubscribe, () => localStorage.getItem(storageKey(test.id)), () => null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const ref = useRef<Draft | null>(null);
  const [view, setView] = useState(0);
  const [now, setNow] = useState(0);
  const [review, setReview] = useState(false);

  // every change is saved, so a call or a closed tab does not lose the test
  function commit(d: Draft | null) {
    ref.current = d;
    setDraft(d);
    if (d && d.step !== "result") localStorage.setItem(storageKey(test.id), JSON.stringify(d));
    else localStorage.removeItem(storageKey(test.id));
  }

  function start(mode: Mode) {
    setView(0);
    setReview(false);
    commit({
      step: mode === "reading" ? "reading" : "listening",
      mode,
      l: L.map(() => []),
      r: R.map(() => []),
      pos: { part: 0, line: 0 },
      endsAt: mode === "reading" ? Date.now() + READING_SEC * 1000 : undefined,
    });
    window.scrollTo({ top: 0 });
  }

  function finish(d: Draft) {
    const ls = d.mode !== "reading" ? sectionScore(L, d.l) : null;
    const rs = d.mode !== "listening" ? sectionScore(R, d.r) : null;
    const lBand = ls ? rawToBand("listening", ls.score, ls.total) : undefined;
    const rBand = rs ? rawToBand("reading", rs.score, rs.total) : undefined;
    const bands = [lBand, rBand].filter((b): b is number => b !== undefined);
    update((st) => {
      st.mocks.push({
        date: todayStr(),
        level: getState().level,
        score: (ls?.score ?? 0) + (rs?.score ?? 0),
        total: (ls?.total ?? 0) + (rs?.total ?? 0),
        band: roundHalf(bands.reduce((a, b) => a + b, 0) / bands.length),
        test: test.id,
        lBand,
        rBand,
      });
    });
    commit({ ...d, step: "result" });
    window.scrollTo({ top: 0 });
  }

  function submitListening() {
    const d = ref.current!;
    L.forEach((p, i) => saveMistakes(p.questions, d.l[i] ?? [], `${test.title} · Listening Part ${i + 1}`));
    stopSpeaking();
    if (d.mode === "both") {
      setView(0);
      commit({ ...d, step: "reading", endsAt: Date.now() + READING_SEC * 1000 });
      window.scrollTo({ top: 0 });
    } else finish(d);
  }

  function submitReading(d: Draft) {
    R.forEach((p, i) => saveMistakes(p.questions, d.r[i] ?? [], `${test.title} · Reading Passage ${i + 1}`));
    const left = Math.max(0, Math.round(((d.endsAt ?? 0) - Date.now()) / 1000));
    finish({ ...d, usedSec: READING_SEC - left });
  }

  // reading countdown; the paper is collected automatically when time is up
  const readingLive = draft?.step === "reading";
  useEffect(() => {
    if (!readingLive) return;
    const t = setInterval(() => {
      setNow(Date.now());
      const d = ref.current;
      if (d?.step === "reading" && d.endsAt && Date.now() >= d.endsAt) submitReading(d);
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingLive]);

  const setAnswers = (kind: "l" | "r", i: number, a: Answer[]) => {
    const d = ref.current!;
    commit({ ...d, [kind]: Object.assign([...d[kind]], { [i]: a }) });
  };

  if (!draft) {
    const mins = Math.round(L.reduce((a, p) => a + p.script.reduce((b, l) => b + l.text.split(" ").length, 0), 0) / 140 + 3 * PART_GAP / 60);
    const rq = R.reduce((a, p) => a + p.questions.length, 0);
    return (
      <div>
        <PageHeader title={test.title} back="/mock" />
        <div className="card space-y-3 leading-relaxed">
          {L.length > 0 && (
            <p>
              🎧 <b>Listening</b>: 4 part, 40 câu, khoảng {mins} phút. Bài nghe <b>chỉ phát một lần</b> (được tạm dừng nhưng không tua lại), giống thi thật.
            </p>
          )}
          <p>
            📰 <b>Reading</b>: 3 bài đọc từ dễ đến khó, {rq} câu, <b>60 phút đếm ngược</b>. Hết giờ hệ thống tự nộp bài.
          </p>
          <p className="text-sm text-slate-600">Đeo tai nghe, ngồi chỗ yên tĩnh, chuẩn bị giấy nháp. Bài làm được lưu liên tục: lỡ thoát ra vẫn làm tiếp được.</p>
        </div>
        {saved && (
          <button
            className="btn-primary mt-4 w-full py-3"
            onClick={() => {
              const d = JSON.parse(saved) as Draft;
              setView(d.step === "listening" ? Math.min(d.pos.part, L.length - 1) : 0);
              commit(d);
            }}
          >
            ↻ Tiếp tục bài đang làm dở
          </button>
        )}
        <div className="mt-4 grid gap-2">
          {L.length > 0 && (
            <button className={saved ? "btn-soft py-3" : "btn-primary py-3"} onClick={() => start("both")}>
              Làm cả bài (khoảng {mins + 60} phút)
            </button>
          )}
          {L.length > 0 && (
            <button className="btn-soft py-3" onClick={() => start("listening")}>
              Chỉ làm Listening (khoảng {mins} phút)
            </button>
          )}
          <button className={!L.length && !saved ? "btn-primary py-3" : "btn-soft py-3"} onClick={() => start("reading")}>
            Chỉ làm Reading (60 phút)
          </button>
        </div>
      </div>
    );
  }

  if (draft.step === "listening") {
    const p = L[view];
    return (
      <div>
        <PageHeader title={`${test.title} · Listening`} />
        <Tabs labels={L.map((_, i) => `Part ${i + 1}`)} value={view} onChange={setView} />
        <ExamAudio
          parts={L}
          pos={draft.pos}
          onPos={(pos) => {
            commit({ ...ref.current!, pos });
            if (pos.part < L.length) setView(pos.part);
          }}
        />
        <p className="muted mb-2 mt-4 text-sm">
          Part {view + 1}: {p.contextVi}
        </p>
        <QuestionSet key={view} questions={p.questions} start={lStart[view]} value={draft.l[view] ?? []} onChange={(a) => setAnswers("l", view, a)} submitted={false} />
        <div className="mt-4 flex gap-2">
          {view < L.length - 1 && (
            <button className="btn-soft flex-1" onClick={() => setView(view + 1)}>
              Part {view + 2} →
            </button>
          )}
          <button
            className="btn-primary flex-1"
            onClick={() => {
              const left = draft.pos.part < L.length;
              if (!left || confirm("Bài nghe chưa phát hết. Vẫn nộp phần Listening?")) submitListening();
            }}
          >
            Nộp bài Listening
          </button>
        </div>
      </div>
    );
  }

  if (draft.step === "reading") {
    const left = Math.max(0, Math.ceil(((draft.endsAt ?? 0) - (now || (draft.endsAt ?? 0) - READING_SEC * 1000)) / 1000));
    const todo = R.reduce((a, p, i) => a + p.questions.filter((_, k) => !answered(draft.r[i]?.[k])).length, 0);
    const p = R[view];
    return (
      <div>
        <PageHeader title={`${test.title} · Reading`} />
        <Tabs
          labels={R.map((_, i) => `Bài ${i + 1}`)}
          value={view}
          onChange={setView}
          right={
            <span className={`rounded-lg px-2 py-1 text-sm font-bold ${left < 300 ? "bg-rose-100 text-rose-700" : "text-slate-700"}`} style={{ fontVariantNumeric: "tabular-nums" }}>
              ⏱ {fmtTime(left)}
            </span>
          }
        />
        <h2 className="h2 mb-2">
          Passage {view + 1}: {p.title}
        </h2>
        <Passage item={p} exam />
        <h2 className="h2 mb-2 mt-5">
          Câu {rStart[view]}–{rStart[view] + p.questions.length - 1}
        </h2>
        <QuestionSet key={view} questions={p.questions} start={rStart[view]} value={draft.r[view] ?? []} onChange={(a) => setAnswers("r", view, a)} submitted={false} />
        <div className="mt-4 flex gap-2">
          {view < R.length - 1 && (
            <button
              className="btn-soft flex-1"
              onClick={() => {
                setView(view + 1);
                window.scrollTo({ top: 0 });
              }}
            >
              Bài {view + 2} →
            </button>
          )}
          <button className="btn-primary flex-1" onClick={() => (!todo || confirm(`Còn ${todo} câu chưa làm. Vẫn nộp bài?`)) && submitReading(ref.current!)}>
            Nộp bài Reading
          </button>
        </div>
      </div>
    );
  }

  // result
  const ls = draft.mode !== "reading" ? sectionScore(L, draft.l) : null;
  const rs = draft.mode !== "listening" ? sectionScore(R, draft.r) : null;
  const lBand = ls && rawToBand("listening", ls.score, ls.total);
  const rBand = rs && rawToBand("reading", rs.score, rs.total);
  return (
    <div>
      <PageHeader title={`Kết quả ${test.title}`} back="/mock" />
      <div className="grid grid-cols-2 gap-3">
        {ls && (
          <div className="card text-center">
            <div className="muted">🎧 Listening</div>
            <div className="text-4xl font-bold text-indigo-600">{lBand?.toFixed(1)}</div>
            <div className="text-sm text-slate-600">
              {ls.score}/{ls.total} câu đúng
            </div>
          </div>
        )}
        {rs && (
          <div className="card text-center">
            <div className="muted">📰 Reading</div>
            <div className="text-4xl font-bold text-indigo-600">{rBand?.toFixed(1)}</div>
            <div className="text-sm text-slate-600">
              {rs.score}/{rs.total} câu đúng
              {draft.usedSec != null && ` · ${fmtTime(draft.usedSec)}`}
            </div>
          </div>
        )}
      </div>
      <div className="card mt-3 text-sm">
        <div className="mb-1 font-semibold">Chi tiết</div>
        {ls?.per.map((s, i) => (
          <div key={`l${i}`} className="flex justify-between border-b border-slate-100 py-1">
            <span>Listening Part {i + 1}</span>
            <b>
              {s}/{L[i].questions.length}
            </b>
          </div>
        ))}
        {rs?.per.map((s, i) => (
          <div key={`r${i}`} className="flex justify-between border-b border-slate-100 py-1">
            <span>
              Reading {i + 1}: {R[i].title}
            </span>
            <b>
              {s}/{R[i].questions.length}
            </b>
          </div>
        ))}
        <p className="muted mt-2">
          Band quy đổi theo bảng điểm IELTS chính thức{rs && rs.total !== 40 ? ` (Reading có ${rs.total} câu nên được quy về thang 40)` : ""}. Câu sai đã được lưu vào Sổ lỗi sai.
        </p>
      </div>
      <button className="btn-soft mt-3 w-full" onClick={() => setReview((v) => !v)}>
        {review ? "Ẩn" : "Xem lại"} bài làm, đáp án và lời thoại
      </button>
      {review && (
        <div className="mt-3 space-y-6">
          {ls &&
            L.map((p, i) => (
              <div key={p.id}>
                <h2 className="h2 mb-2">Listening Part {i + 1}</h2>
                <QuestionSet questions={p.questions} start={lStart[i]} value={draft.l[i] ?? []} submitted />
                <details className="card mt-2 text-sm">
                  <summary className="cursor-pointer font-semibold">Lời thoại</summary>
                  <div className="mt-2 space-y-1.5">
                    {p.script.map((l, k) => (
                      <p key={k}>
                        <b className={l.gender === "f" ? "text-pink-600" : "text-sky-700"}>{l.speaker}:</b> {l.text}
                      </p>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          {rs &&
            R.map((p, i) => (
              <div key={p.id}>
                <h2 className="h2 mb-2">
                  Reading {i + 1}: {p.title}
                </h2>
                <details className="mb-2">
                  <summary className="cursor-pointer text-sm font-semibold text-indigo-700">Xem bài đọc</summary>
                  <div className="mt-2">
                    <Passage item={p} />
                  </div>
                </details>
                <QuestionSet questions={p.questions} start={rStart[i]} value={draft.r[i] ?? []} submitted />
              </div>
            ))}
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="btn-soft" onClick={() => commit(null)}>
          Làm lại đề này
        </button>
        <Link href="/mock" className="btn-primary">
          Đề khác
        </Link>
      </div>
    </div>
  );
}
