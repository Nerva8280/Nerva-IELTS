"use client";
import { useState } from "react";
import type { Question } from "@/content/types";
import { addMistakes } from "@/lib/notebook";

type Answer = string | number | number[] | undefined;

const norm = (s: string) => s.trim().toLowerCase().replace(/[.,!?;:'"]/g, "").replace(/\s+/g, " ");

export function isCorrect(q: Question, a: Answer): boolean {
  if (a === undefined || a === "") return false;
  switch (q.type) {
    case "mcq":
    case "match":
      return a === q.answer;
    case "tfng":
    case "ynng":
      return a === q.answer;
    case "multi":
      return Array.isArray(a) && a.length === q.answer.length && q.answer.every((x) => a.includes(x));
    case "gap":
      return q.answer.some((x) => norm(x) === norm(String(a)));
  }
}

function correctText(q: Question) {
  switch (q.type) {
    case "mcq":
    case "match":
      return q.options[q.answer];
    case "multi":
      return q.answer.map((i) => q.options[i]).join(" + ");
    case "gap":
      return q.answer[0];
    default:
      return q.answer;
  }
}

function answerText(q: Question, a: Answer) {
  if (a === undefined || a === "" || (Array.isArray(a) && !a.length)) return "";
  if ((q.type === "mcq" || q.type === "match") && typeof a === "number") return q.options[a];
  if (q.type === "multi" && Array.isArray(a)) return a.map((i) => q.options[i]).join(" + ");
  return String(a);
}

const CHOICES: Record<"tfng" | "ynng", string[]> = { tfng: ["TRUE", "FALSE", "NOT GIVEN"], ynng: ["YES", "NO", "NOT GIVEN"] };

function optionClass(isAns: boolean, chosen: boolean, checked: boolean) {
  return `rounded-xl border px-3 py-2 text-left text-sm transition ${
    isAns ? "border-emerald-500 bg-emerald-50" : chosen && checked ? "border-rose-400 bg-rose-50" : chosen ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
  }`;
}

/** Renders questions (with IELTS-style group instructions); after "Nộp bài" shows right/wrong with explanations. */
export default function QuestionSet({
  questions,
  onSubmit,
  submitLabel = "Nộp bài",
  source,
}: {
  questions: Question[];
  onSubmit?: (score: number, total: number) => void;
  submitLabel?: string;
  source?: string; // when set, wrong answers are saved to the mistake notebook
}) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [checked, setChecked] = useState(false);
  const set = (i: number, v: Answer) => !checked && setAnswers((a) => Object.assign([...a], { [i]: v }));
  const score = questions.filter((q, i) => isCorrect(q, answers[i])).length;

  return (
    <div className="space-y-4">
      {questions.map((q, i) => {
        const ok = checked && isCorrect(q, answers[i]);
        const bad = checked && !ok;
        const a = answers[i];
        const newGroup = q.group && q.group.title !== questions[i - 1]?.group?.title;
        return (
          <div key={i} className="space-y-4">
            {newGroup && q.group && (
              <div className="rounded-2xl bg-indigo-50 p-4 text-sm ring-1 ring-indigo-100">
                <div className="font-bold text-indigo-900">{q.group.title}</div>
                {q.group.text && <p className="mt-1 whitespace-pre-line leading-relaxed text-slate-700">{q.group.text}</p>}
                {q.group.list && (
                  <ul className="mt-2 space-y-1 rounded-xl bg-white p-3 text-slate-800">
                    {q.group.list.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className={`card ${ok ? "ring-emerald-300" : bad ? "ring-rose-300" : ""}`}>
              <div className="mb-2 text-sm font-semibold text-slate-400">
                Câu {i + 1}
                {q.type === "tfng" && " · TRUE / FALSE / NOT GIVEN"}
                {q.type === "ynng" && " · YES / NO / NOT GIVEN"}
                {q.type === "multi" && ` · Chọn ${q.answer.length} đáp án`}
              </div>

              {q.type === "gap" && (
                <div className="leading-loose">
                  {q.q.split("____").map((part, k) => (
                    <span key={k}>
                      {part}
                      {k === 0 && (
                        <input
                          className={`mx-1 inline-block w-36 rounded-lg border px-2 py-0.5 ${ok ? "border-emerald-500 bg-emerald-50" : bad ? "border-rose-400 bg-rose-50" : "border-slate-300"}`}
                          value={String(a ?? "")}
                          onChange={(e) => set(i, e.target.value)}
                          disabled={checked}
                          autoCapitalize="off"
                          autoCorrect="off"
                        />
                      )}
                    </span>
                  ))}
                </div>
              )}

              {q.type === "match" && (
                <>
                  <p className="mb-2 font-medium">{q.q}</p>
                  <select
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm ${ok ? "border-emerald-500 bg-emerald-50" : bad ? "border-rose-400 bg-rose-50" : "border-slate-300 bg-white"}`}
                    value={typeof a === "number" ? a : ""}
                    disabled={checked}
                    onChange={(e) => set(i, e.target.value === "" ? undefined : Number(e.target.value))}
                  >
                    <option value="">Chọn…</option>
                    {q.options.map((o, k) => (
                      <option key={k} value={k}>
                        {o}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {(q.type === "mcq" || q.type === "tfng" || q.type === "ynng") && (
                <>
                  <p className="mb-3 font-medium">{q.q}</p>
                  <div className="grid gap-2">
                    {(q.type === "mcq" ? q.options : CHOICES[q.type]).map((opt, k) => {
                      const val = q.type === "mcq" ? k : opt;
                      const isAns = checked && (q.type === "mcq" ? q.answer === k : q.answer === opt);
                      return (
                        <button key={k} type="button" onClick={() => set(i, val)} className={optionClass(isAns, a === val, checked)}>
                          {q.type === "mcq" && <span className="mr-2 font-semibold text-slate-400">{"ABCDEFG"[k]}</span>}
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {q.type === "multi" && (
                <>
                  <p className="mb-3 font-medium">{q.q}</p>
                  <div className="grid gap-2">
                    {q.options.map((opt, k) => {
                      const picked = Array.isArray(a) && a.includes(k);
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            const cur = Array.isArray(a) ? a : [];
                            if (picked) set(i, cur.filter((x) => x !== k));
                            else if (cur.length < q.answer.length) set(i, [...cur, k]);
                          }}
                          className={optionClass(checked && q.answer.includes(k), picked, checked)}
                        >
                          <span className="mr-2 font-semibold text-slate-400">{picked ? "☑" : "☐"} {"ABCDEFG"[k]}</span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {checked && (
                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
                  <div className={ok ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{ok ? "✓ Đúng" : `✗ Đáp án: ${correctText(q)}`}</div>
                  {q.explain && <p className="mt-1 text-slate-600">{q.explain}</p>}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {!checked ? (
        <button
          className="btn-primary w-full"
          onClick={() => {
            setChecked(true);
            onSubmit?.(score, questions.length);
            if (source)
              addMistakes(
                questions
                  .map((q, i) => ({ q, a: answers[i] }))
                  .filter(({ q, a }) => !isCorrect(q, a))
                  .map(({ q, a }) => ({
                    source,
                    kind: "exercise" as const,
                    original: `${q.q}${answerText(q, a) ? ` (bạn chọn: ${answerText(q, a)})` : ""}`,
                    corrected: correctText(q),
                    explanationVi: q.explain ?? "",
                  })),
              );
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
