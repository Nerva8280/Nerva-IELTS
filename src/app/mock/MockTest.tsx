"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import type { Level, ListeningItem, ReadingPassage } from "@/content/types";
import { getState, markDone, update, useAppState } from "@/lib/store";
import { todayStr } from "@/lib/dates";
import { estimateBand } from "@/lib/progress";
import QuestionSet from "@/components/QuestionSet";
import { DoneBanner, fmtTime, LevelChip, PageHeader, useTimer } from "@/components/ui";
import { ScriptPlayer } from "../listening/[id]/ListeningView";
import { Passage } from "../reading/[id]/ReadingView";


type Ref = { id: string; level: Level };

/** Mock test menu: the short level-based test and the full IELTS-format tests. */
export function MockHub({ listening, reading, tests }: { listening: Ref[]; reading: Ref[]; tests: { id: string; title: string; listening: boolean; reading: string[] }[] }) {
  const router = useRouter();
  const s = useAppState();

  function startMini() {
    const st = getState();
    const pick = (list: Ref[]) => {
      const atLevel = list.filter((x) => x.level === st.level);
      const pool = atLevel.length ? atLevel : list;
      const fresh = pool.filter((x) => !st.done[x.id]);
      const from = fresh.length ? fresh : pool;
      return from[Math.floor(Math.random() * from.length)].id;
    };
    router.push(`/mock?l=${pick(listening)}&r=${pick(reading)}`);
  }

  return (
    <div>
      <PageHeader title="Thi thử" back="/practice" />
      <button onClick={startMini} className="card mb-3 flex w-full items-center gap-3 text-left">
        <span className="text-3xl">⚡</span>
        <div className="flex-1">
          <div className="font-semibold">Mock test mini · 15–20 phút</div>
          <div className="text-sm text-slate-600">1 bài Listening + 1 bài Reading theo trình độ {s.level}. Hợp với buổi học hằng ngày.</div>
        </div>
        <span className="text-slate-400">→</span>
      </button>
      <h2 className="h2 mb-2 mt-5">Đề thi thử đầy đủ</h2>
      <p className="muted mb-3 text-sm">Đúng cấu trúc IELTS: Listening 4 part 40 câu, Reading 3 bài 60 phút. Có thể làm riêng từng phần.</p>
      <div className="grid gap-2">
        {tests.map((t) => {
          const last = [...s.mocks].reverse().find((m) => m.test === t.id);
          return (
            <Link key={t.id} href={`/mock/full/${t.id}`} className="card flex items-center gap-3">
              <span className="text-3xl">🏁</span>
              <div className="flex-1">
                <div className="font-semibold">
                  {t.title}
                  {!t.listening && <span className="ml-2 text-xs font-normal text-slate-500">chỉ Reading</span>}
                </div>
                <div className="text-xs text-slate-500">{t.reading.join(" · ")}</div>
                {last && (
                  <div className="mt-1 text-xs font-semibold text-indigo-600">
                    Lần gần nhất {last.date}: {last.lBand != null && `Listening ${last.lBand}`}
                    {last.lBand != null && last.rBand != null && " · "}
                    {last.rBand != null && `Reading ${last.rBand}`}
                  </div>
                )}
              </div>
              <span className="text-slate-400">→</span>
            </Link>
          );
        })}
      </div>
      {s.mocks.length > 0 && <History />}
    </div>
  );
}

function History() {
  const s = useAppState();
  return (
    <div className="card mt-4">
      <div className="h2 mb-2">Lịch sử thi thử</div>
      {[...s.mocks].reverse().slice(0, 10).map((m, i) => (
        <div key={i} className="flex justify-between gap-2 border-b border-slate-100 py-1.5 text-sm">
          <span>{m.date}</span>
          <span className="flex-1 text-slate-600">
            {m.test ? `Full Test ${m.test}` : `Mini ${m.level}`} · {m.score}/{m.total}
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
        <Link href="/mock" className="btn-soft">
          Làm đề khác
        </Link>
      </DoneBanner>
      <History />
    </div>
  );
}
