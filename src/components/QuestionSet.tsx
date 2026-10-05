"use client";
import { useState } from "react";
import type { Question } from "@/content/types";

const norm = (s: string) => s.trim().toLowerCase().replace(/[.,!?;:'"]/g, "").replace(/\s+/g, " ");

export function isCorrect(q: Question, a: string | number | undefined): boolean {
  if (a === undefined || a === "") return false;
  if (q.type === "mcq") return a === q.answer;
  if (q.type === "tfng") return a === q.answer;
  return q.answer.some((x) => norm(x) === norm(String(a)));
}

function correctText(q: Question) {
  if (q.type === "mcq") return q.options[q.answer];
  if (q.type === "tfng") return q.answer;
  return q.answer[0];
}

/** Renders questions; after "Nộp bài" shows right/wrong with explanations and reports the score. */
export default function QuestionSet({
  questions,
  onSubmit,
  submitLabel = "Nộp bài",
}: {
  questions: Question[];
  onSubmit?: (score: number, total: number) => void;
  submitLabel?: string;
}) {
  const [answers, setAnswers] = useState<(string | number | undefined)[]>([]);
  const [checked, setChecked] = useState(false);
  const set = (i: number, v: string | number) => !checked && setAnswers((a) => Object.assign([...a], { [i]: v }));
  const score = questions.filter((q, i) => isCorrect(q, answers[i])).length;

  return (
    <div className="space-y-4">
      {questions.map((q, i) => {
        const ok = checked && isCorrect(q, answers[i]);
        const bad = checked && !ok;
        return (
          <div key={i} className={`card ${ok ? "ring-emerald-300" : bad ? "ring-rose-300" : ""}`}>
            <div className="mb-2 text-sm font-semibold text-slate-400">
              Câu {i + 1}
              {q.type === "tfng" && " · TRUE / FALSE / NOT GIVEN"}
            </div>
            {q.type === "gap" ? (
              <div className="leading-loose">
                {q.q.split("____").map((part, k) => (
                  <span key={k}>
                    {part}
                    {k === 0 && (
                      <input
                        className={`mx-1 inline-block w-36 rounded-lg border px-2 py-0.5 ${ok ? "border-emerald-500 bg-emerald-50" : bad ? "border-rose-400 bg-rose-50" : "border-slate-300"}`}
                        value={String(answers[i] ?? "")}
                        onChange={(e) => set(i, e.target.value)}
                        disabled={checked}
                        autoCapitalize="off"
                        autoCorrect="off"
                      />
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <>
                <p className="mb-3 font-medium">{q.q}</p>
                <div className="grid gap-2">
                  {(q.type === "mcq" ? q.options : ["TRUE", "FALSE", "NOT GIVEN"]).map((opt, k) => {
                    const val = q.type === "mcq" ? k : opt;
                    const chosen = answers[i] === val;
                    const isAns = checked && (q.type === "mcq" ? q.answer === k : q.answer === opt);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => set(i, val)}
                        className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                          isAns
                            ? "border-emerald-500 bg-emerald-50"
                            : chosen && checked
                              ? "border-rose-400 bg-rose-50"
                              : chosen
                                ? "border-indigo-500 bg-indigo-50"
                                : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {q.type === "mcq" && <span className="mr-2 font-semibold text-slate-400">{"ABCDEF"[k]}</span>}
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {checked && (
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
                <div className={ok ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                  {ok ? "✓ Đúng" : `✗ Đáp án: ${correctText(q)}`}
                </div>
                {q.explain && <p className="mt-1 text-slate-600">{q.explain}</p>}
              </div>
            )}
          </div>
        );
      })}
      {!checked ? (
        <button
          className="btn-primary w-full"
          onClick={() => {
            setChecked(true);
            onSubmit?.(score, questions.length);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          {submitLabel}
        </button>
      ) : (
        <div className="card text-center">
          <div className="text-3xl font-bold text-indigo-600">
            {score}/{questions.length}
          </div>
          <button
            className="btn-ghost mt-3"
            onClick={() => {
              setAnswers([]);
              setChecked(false);
            }}
          >
            Làm lại
          </button>
        </div>
      )}
    </div>
  );
}

export function ScoreSummary({ score, total }: { score: number; total: number }) {
  const pct = total ? score / total : 0;
  return (
    <div className="card mb-4 flex items-center gap-4">
      <div className="text-3xl font-bold text-indigo-600">
        {score}/{total}
      </div>
      <div className="muted">{pct >= 0.8 ? "Xuất sắc! 🎉" : pct >= 0.6 ? "Khá tốt, xem lại câu sai nhé." : "Đọc kỹ giải thích các câu sai rồi làm lại."}</div>
    </div>
  );
}
