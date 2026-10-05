"use client";
import { useState } from "react";
import type { ReadingPassage } from "@/content/types";
import { markDone } from "@/lib/store";
import QuestionSet from "@/components/QuestionSet";
import { DoneBanner, fmtTime, LevelChip, PageHeader, SpeakButton, useTimer } from "@/components/ui";

export function Passage({ item }: { item: ReadingPassage }) {
  const [showVocab, setShowVocab] = useState(false);
  return (
    <>
      <div className="card space-y-3 leading-relaxed">
        {item.passage.split(/\n\s*\n/).map((p, i) => (
          <p key={i}>
            <span className="mr-1 font-bold text-indigo-400">{String.fromCharCode(65 + i)}</span>
            {p}
          </p>
        ))}
        <SpeakButton text={item.passage} label="Nghe cả bài" />
      </div>
      <button className="btn-ghost mt-3 w-full" onClick={() => setShowVocab((v) => !v)}>
        {showVocab ? "Ẩn" : "Xem"} từ vựng khó ({item.vocab.length})
      </button>
      {showVocab && (
        <div className="card mt-2 grid gap-1 text-sm">
          {item.vocab.map((v) => (
            <div key={v.word}>
              <b>{v.word}</b>: {v.vi}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function ReadingView({ item }: { item: ReadingPassage }) {
  const [result, setResult] = useState<[number, number] | null>(null);
  const [sec] = useTimer(!result);
  const words = item.passage.split(/\s+/).length;
  return (
    <div>
      <PageHeader title={item.title} back="/practice" right={<LevelChip level={item.level} />} />
      <div className="muted mb-3 flex justify-between">
        <span>{words} từ · {item.questions.length} câu hỏi</span>
        <span>⏱ {fmtTime(sec)}</span>
      </div>
      <Passage item={item} />
      <h2 className="h2 mb-2 mt-5">Câu hỏi</h2>
      <QuestionSet
        questions={item.questions}
        onSubmit={(score, total) => {
          markDone(item.id, score, total);
          setResult([score, total]);
        }}
      />
      {result && (
        <DoneBanner>
          <div className="font-semibold">
            {result[0]}/{result[1]} câu đúng · {fmtTime(sec)}
          </div>
        </DoneBanner>
      )}
    </div>
  );
}
