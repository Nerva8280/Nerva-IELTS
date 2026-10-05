"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Level, ListeningItem, ReadingPassage } from "@/content/types";
import { getState, markDone, update, useAppState } from "@/lib/store";
import { todayStr } from "@/lib/dates";
import QuestionSet from "@/components/QuestionSet";
import { DoneBanner, fmtTime, LevelChip, PageHeader, useTimer } from "@/components/ui";
import { ScriptPlayer } from "../listening/[id]/ListeningView";
import { Passage } from "../reading/[id]/ReadingView";

const BASE_BAND: Record<Level, number> = { A1: 2.5, A2: 3.5, B1: 4.5, B2: 5.5, C1: 6.5 };

export function estimateBand(level: Level, pct: number) {
  const adj = pct >= 0.85 ? 1 : pct >= 0.7 ? 0.5 : pct >= 0.5 ? 0 : -0.5;
  return Math.max(1, Math.min(9, BASE_BAND[level] + adj));
}

type Ref = { id: string; level: Level };

/** Picks one listening and one reading at the learner's level, preferring ones not done yet. */
export function MockPicker({ listening, reading }: { listening: Ref[]; reading: Ref[] }) {
  const router = useRouter();
  const s = useAppState();
  useEffect(() => {
    const st = getState();
    const pick = (list: Ref[]) => {
      const atLevel = list.filter((x) => x.level === st.level);
      const pool = atLevel.length ? atLevel : list;
      const fresh = pool.filter((x) => !st.done[x.id]);
      const from = fresh.length ? fresh : pool;
      return from[Math.floor(Math.random() * from.length)].id;
    };
    router.replace(`/mock?l=${pick(listening)}&r=${pick(reading)}`);
  }, [listening, reading, router]);

  return (
    <div>
      <PageHeader title="Mock test mini" back="/practice" />
      <div className="muted">Đang chọn đề…</div>
      {s.mocks.length > 0 && <History />}
    </div>
  );
}

function History() {
  const s = useAppState();
  return (
    <div className="card mt-4">
      <div className="h2 mb-2">Lịch sử mock test</div>
      {[...s.mocks].reverse().slice(0, 10).map((m, i) => (
        <div key={i} className="flex justify-between border-b border-slate-100 py-1.5 text-sm">
          <span>{m.date}</span>
          <span>
            {m.level} · {m.score}/{m.total}
          </span>
          <b className="text-indigo-600">~{m.band}</b>
        </div>
      ))}
    </div>
  );
}

export default function MockTest({ listening, reading }: { listening: ListeningItem; reading: ReadingPassage }) {
  const [step, setStep] = useState<"intro" | "listening" | "reading" | "result">("intro");
  const [lScore, setLScore] = useState<[number, number] | null>(null);
  const [rScore, setRScore] = useState<[number, number] | null>(null);
  const [sec, setSec] = useTimer(step === "reading");
  const level = reading.level;

  function finish(r: [number, number]) {
    setRScore(r);
    const score = (lScore?.[0] ?? 0) + r[0];
    const total = (lScore?.[1] ?? 0) + r[1];
    const band = estimateBand(level, score / total);
    update((st) => void st.mocks.push({ date: todayStr(), level, score, total, band }));
    markDone(listening.id, lScore?.[0], lScore?.[1]);
    markDone(reading.id, r[0], r[1]);
    setStep("result");
    window.scrollTo({ top: 0 });
  }

  if (step === "intro")
    return (
      <div>
        <PageHeader title="Mock test mini" back="/practice" right={<LevelChip level={level} />} />
        <div className="card space-y-2 leading-relaxed">
          <p>
            Gồm <b>1 bài Listening</b> ({listening.questions.length} câu) và <b>1 bài Reading</b> ({reading.questions.length} câu), khoảng 15–20 phút.
          </p>
          <p className="text-slate-600">Như thi thật: chỉ nghe tối đa 2 lần, không xem lời thoại, làm Reading có bấm giờ.</p>
        </div>
        <button className="btn-primary mt-4 w-full py-3" onClick={() => setStep("listening")}>
          Bắt đầu
        </button>
        {getState().mocks.length > 0 && <History />}
      </div>
    );

  if (step === "listening")
    return (
      <div>
        <PageHeader title="1. Listening" right={<LevelChip level={level} />} />
        <p className="muted mb-3">{listening.contextVi}</p>
        <ScriptPlayer item={listening} showTranscript={!!lScore} />
        <h2 className="h2 mb-2 mt-5">Câu hỏi</h2>
        <QuestionSet questions={listening.questions} submitLabel="Nộp phần Listening" onSubmit={(a, b) => setLScore([a, b])} />
        {lScore && (
          <button
            className="btn-primary mt-4 w-full py-3"
            onClick={() => {
              setSec(0);
              setStep("reading");
              window.scrollTo({ top: 0 });
            }}
          >
            Sang phần Reading →
          </button>
        )}
      </div>
    );

  if (step === "reading")
    return (
      <div>
        <PageHeader title="2. Reading" right={<span className="muted">⏱ {fmtTime(sec)}</span>} />
        <Passage item={reading} />
        <h2 className="h2 mb-2 mt-5">Câu hỏi</h2>
        <QuestionSet questions={reading.questions} submitLabel="Nộp bài & xem kết quả" onSubmit={(a, b) => finish([a, b])} />
      </div>
    );

  const score = (lScore?.[0] ?? 0) + (rScore?.[0] ?? 0);
  const total = (lScore?.[1] ?? 0) + (rScore?.[1] ?? 0);
  const band = estimateBand(level, score / total);
  return (
    <div>
      <PageHeader title="Kết quả mock test" back="/practice" />
      <div className="card text-center">
        <div className="muted">Band ước tính (Listening + Reading)</div>
        <div className="text-5xl font-bold text-indigo-600">{band.toFixed(1)}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-slate-50 p-2">
            Listening: <b>{lScore?.[0]}/{lScore?.[1]}</b>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            Reading: <b>{rScore?.[0]}/{rScore?.[1]}</b> · {fmtTime(sec)}
          </div>
        </div>
        <p className="muted mt-3">
          Đây là ước lượng thô từ bài mini trình độ {level}, không thay thế đề thi thật đầy đủ (40 câu mỗi kỹ năng).
        </p>
      </div>
      <DoneBanner>
        <a href="/mock" className="btn-soft">
          Làm đề khác
        </a>
      </DoneBanner>
      <History />
    </div>
  );
}
