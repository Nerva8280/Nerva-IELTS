"use client";
import { useState } from "react";
import type { Question } from "@/content/types";
import { addMistakes } from "@/lib/notebook";

export type Answer = string | number | number[] | undefined;

// "0161 555 0147" = "01615550147", "£85" = "85", "B-R-E-N-T-O-N" = "Brenton"
const squash = (s: string) => s.toLowerCase().replace(/[.,!?;:'"£$€\s-]/g, "");

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
      return q.answer.some((x) => squash(x) === squash(String(a)));
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

export const scoreOf = (questions: Question[], answers: Answer[]) => questions.filter((q, i) => isCorrect(q, answers[i])).length;

/** Saves the wrong answers of a submitted set to the mistake notebook. */
export function saveMistakes(questions: Question[], answers: Answer[], source: string, standalone = false) {
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
        ...(standalone ? { question: q } : {}),
      })),
  );
}

function optionClass(isAns: boolean, chosen: boolean, checked: boolean) {
  return `rounded-xl border px-3 py-2 text-left text-sm transition ${
    isAns ? "border-emerald-500 bg-emerald-50" : chosen && checked ? "border-rose-400 bg-rose-50" : chosen ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
  }`;
}

/**
 * Renders questions (with IELTS-style group instructions); after "Nộp bài" shows right/wrong with explanations.
 * Exam sections pass `value`/`onChange` and `submitted` so several sets share one submit button.
 */
export default function QuestionSet({
  questions,
  onSubmit,
  submitLabel = "Nộp bài",
  source,
  start = 1,
  value,
  onChange,
  submitted,
  standalone = false,
}: {
  questions: Question[];
  onSubmit?: (score: number, total: number) => void;
  submitLabel?: string;
  source?: string; // when set, wrong answers are saved to the mistake notebook
  start?: number; // number of the first question (later exam parts continue the numbering)
  value?: Answer[];
  onChange?: (answers: Answer[]) => void;
  submitted?: boolean; // controlled by the parent: no own submit button
  standalone?: boolean; // questions make sense without a passage, so the notebook can ask them again
}) {
  const [own, setOwn] = useState<Answer[]>([]);
  const [ownChecked, setChecked] = useState(false);
  const answers = value ?? own;
  const controlled = submitted !== undefined;
  const checked = controlled ? submitted : ownChecked;
  const set = (i: number, v: Answer) => {
    if (checked) return;
    const next = Object.assign([...answers], { [i]: v });
    if (value === undefined) setOwn(next);
    onChange?.(next);
  };
  const score = scoreOf(questions, answers);
  const off = start - 1;
  // group texts are numbered within their own set ("Questions 1–5", "(3) ____")
  const shiftTitle = (t: string) => (off ? t.replace(/\d+/g, (d) => String(Number(d) + off)) : t);
  const shiftText = (t: string) => (off ? t.replace(/\((\d+)\) ____/g, (_, d) => `(${Number(d) + off}) ____`) : t);

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
                <div className="font-bold text-indigo-900">{shiftTitle(q.group.title)}</div>
                {q.group.text && <p className="mt-1 whitespace-pre-line leading-relaxed text-slate-700">{shiftText(q.group.text)}</p>}
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
                Câu {i + start}
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
      {controlled ? null : !checked ? (
        <button
          className="btn-primary w-full"
          onClick={() => {
            setChecked(true);
            onSubmit?.(score, questions.length);
            if (source) saveMistakes(questions, answers, source, standalone);
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
              setOwn([]);
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
