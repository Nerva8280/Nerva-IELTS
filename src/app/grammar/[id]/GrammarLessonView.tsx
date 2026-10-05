"use client";
import { useState } from "react";
import type { GrammarLesson } from "@/content/types";
import { markDone } from "@/lib/store";
import QuestionSet from "@/components/QuestionSet";
import { DoneBanner, LevelChip, PageHeader, RichText, SpeakButton } from "@/components/ui";

export default function GrammarLessonView({ lesson }: { lesson: GrammarLesson }) {
  const [result, setResult] = useState<[number, number] | null>(null);
  return (
    <div>
      <PageHeader title={lesson.title} back="/practice" right={<LevelChip level={lesson.level} />} />
      <p className="mb-4 text-slate-600">{lesson.summaryVi}</p>
      <div className="card">
        <RichText text={lesson.explanationVi} />
      </div>
      <h2 className="h2 mb-2 mt-5">Ví dụ</h2>
      <div className="space-y-2">
        {lesson.examples.map((e, i) => (
          <div key={i} className="card flex items-start gap-3 py-3">
            <div className="flex-1">
              <div className="font-medium">{e.en}</div>
              <div className="text-sm text-slate-500">{e.vi}</div>
            </div>
            <SpeakButton text={e.en} />
          </div>
        ))}
      </div>
      <h2 className="h2 mb-2 mt-5">Bài tập</h2>
      <QuestionSet
        questions={lesson.exercises}
        onSubmit={(score, total) => {
          markDone(lesson.id, score, total);
          setResult([score, total]);
        }}
      />
      {result && (
        <DoneBanner>
          <div className="font-semibold">
            Hoàn thành bài: {result[0]}/{result[1]} câu đúng
          </div>
        </DoneBanner>
      )}
    </div>
  );
}
