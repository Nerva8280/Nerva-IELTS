"use client";
import { useEffect, useRef, useState } from "react";
import type { ListeningItem } from "@/content/types";
import { markDone } from "@/lib/store";
import { speak, stopSpeaking } from "@/lib/tts";
import QuestionSet from "@/components/QuestionSet";
import { DoneBanner, LevelChip, PageHeader } from "@/components/ui";

/** Reads a script line by line with a voice matching each speaker's gender. */
export function ScriptPlayer({ item, showTranscript }: { item: ListeningItem; showTranscript: boolean }) {
  const [line, setLine] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [plays, setPlays] = useState(0);
  const run = useRef(0);

  useEffect(() => () => stopSpeaking(), []);

  async function play(from = 0) {
    const my = ++run.current;
    setPlaying(true);
    setPlays((p) => p + 1);
    for (let i = from; i < item.script.length; i++) {
      if (run.current !== my) return;
      setLine(i);
      await speak(item.script[i].text, { gender: item.script[i].gender, rate });
      await new Promise((r) => setTimeout(r, 350));
    }
    if (run.current === my) {
      setPlaying(false);
      setLine(-1);
    }
  }

  function stop() {
    run.current++;
    stopSpeaking();
    setPlaying(false);
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2">
        {playing ? (
          <button className="btn-primary flex-1 py-3" onClick={stop}>
            ⏸ Dừng
          </button>
        ) : (
          <button className="btn-primary flex-1 py-3" onClick={() => play(line > 0 ? line : 0)}>
            ▶ {line > 0 ? "Nghe tiếp" : plays ? "Nghe lại" : "Bắt đầu nghe"}
          </button>
        )}
        {!playing && line > 0 && (
          <button className="btn-ghost py-3" onClick={() => play(0)}>
            ⟲ Từ đầu
          </button>
        )}
        <select className="rounded-xl border border-slate-300 bg-white px-2 py-2.5 text-sm" value={rate} onChange={(e) => setRate(Number(e.target.value))}>
          <option value={0.75}>0.75×</option>
          <option value={0.9}>0.9×</option>
          <option value={1}>1×</option>
          <option value={1.1}>1.1×</option>
        </select>
      </div>
      {line >= 0 && (
        <div className="muted mt-2">
          Đoạn {line + 1}/{item.script.length} · {item.script[line].speaker}
        </div>
      )}
      {showTranscript && (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
          {item.script.map((l, i) => (
            <button key={i} onClick={() => play(i)} className={`block w-full rounded-lg px-2 py-1 text-left text-sm ${i === line ? "bg-indigo-50" : ""}`}>
              <b className={l.gender === "f" ? "text-pink-600" : "text-sky-700"}>{l.speaker}:</b> {l.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ListeningView({ item }: { item: ListeningItem }) {
  const [result, setResult] = useState<[number, number] | null>(null);
  const [transcript, setTranscript] = useState(false);
  return (
    <div>
      <PageHeader title={item.title} back="/practice" right={<LevelChip level={item.level} />} />
      <p className="muted mb-3">
        Part {item.part} · {item.contextVi}
      </p>
      <div className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
        Mẹo IELTS: đọc trước câu hỏi, gạch chân từ khóa, rồi mới bấm nghe. Lần đầu hãy nghe không xem lời thoại.
      </div>
      <ScriptPlayer item={item} showTranscript={transcript} />
      <button className="btn-ghost mt-2 w-full" onClick={() => setTranscript((t) => !t)}>
        {transcript ? "Ẩn" : "Hiện"} lời thoại {!result && "(nên làm bài xong rồi xem)"}
      </button>
      <h2 className="h2 mb-2 mt-5">Câu hỏi</h2>
      <QuestionSet
        questions={item.questions}
        onSubmit={(score, total) => {
          markDone(item.id, score, total);
          setResult([score, total]);
          setTranscript(true);
        }}
      />
      {result && (
        <DoneBanner>
          <div className="font-semibold">
            {result[0]}/{result[1]} câu đúng. Hãy nghe lại kèm lời thoại để bắt những chỗ chưa nghe ra.
          </div>
        </DoneBanner>
      )}
    </div>
  );
}
