"use client";
import { useState } from "react";
import type { WritingPrompt } from "@/content/types";
import type { WritingGrade } from "@/lib/writing-grader";
import { getState, update } from "@/lib/store";
import { todayStr } from "@/lib/dates";
import { addMistakes } from "@/lib/notebook";
import AiQuota, { notifyGraded } from "@/components/AiQuota";
import { useLearnedWords } from "@/lib/vocab-client";
import { useAuth } from "@/components/AppShell";
import { BandBars, Corrections, WordAdvice, bandColor } from "@/components/feedback";
import { SpeakButton } from "@/components/ui";

/** "AI chấm bài": sends the essay to Gemini and shows IELTS bands, corrections and a rewrite. */
export default function WritingAi({ item, text }: { item: WritingPrompt; text: string }) {
  const { me } = useAuth();
  const words = useLearnedWords();
  const [state, setState] = useState<"idle" | "grading" | "done" | "error">("idle");
  const [grade, setGrade] = useState<WritingGrade | null>(null);
  const [error, setError] = useState("");
  const [showRewrite, setShowRewrite] = useState(false);
  const taskName = item.task === 1 ? "Task Achievement" : "Task Response";

  async function run() {
    setState("grading");
    setError("");
    try {
      const res = await fetch("/api/writing/grade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, essay: text, level: getState().level, words }),
      });
      notifyGraded();
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Lỗi máy chủ");
      const g = j as WritingGrade;
      setGrade(g);
      setState("done");
      update((st) => {
        st.writingGrades = [...(st.writingGrades ?? []), { date: todayStr(), id: item.id, bands: g.bands }].slice(-200);
        st.essays[item.id] = { ...st.essays[item.id], text, date: todayStr(), selfBand: g.bands.overall };
      });
      const source = `Viết: ${item.id.startsWith("w0") ? "Nền tảng" : `Task ${item.task}`}`;
      addMistakes(g.corrections.map((c) => ({ source, kind: c.kind, original: c.original, corrected: c.corrected, explanationVi: c.explanationVi })));
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }

  if (!me?.user)
    return <div className="card mt-5 text-sm text-slate-600">🤖 AI chấm bài cần đăng nhập Google (Cài đặt → Thoát → Đăng nhập bằng Google).</div>;

  if (state !== "done" || !grade)
    return (
      <div className="card mt-5 text-center">
        <div className="h2 mb-1">🤖 AI chấm bài theo tiêu chí IELTS</div>
        <p className="muted mb-3">Chấm 4 tiêu chí, sửa từng lỗi, viết lại bài cao hơn 1 band, khoảng 10 giây.</p>
        {state === "grading" ? (
          <div className="py-2 font-semibold text-indigo-600">AI đang đọc và chấm bài…</div>
        ) : (
          <button className="btn-primary w-full py-3" onClick={run}>
            🤖 AI chấm bài của tôi
          </button>
        )}
        {state === "error" && <p className="mt-3 rounded-xl bg-rose-50 p-2.5 text-sm text-rose-700">{error}</p>}
        <AiQuota className="mt-2" />
      </div>
    );

  const b = grade.bands;
  return (
    <div className="mt-5">
      <div className="card text-center">
        <div className="muted">Band Writing ước tính</div>
        <div className={`text-5xl font-bold ${bandColor(b.overall)}`}>{b.overall.toFixed(1)}</div>
        {grade.strengthsVi.length > 0 && (
          <ul className="mt-3 space-y-1 text-left text-sm text-emerald-700">
            {grade.strengthsVi.map((x) => (
              <li key={x}>✓ {x}</li>
            ))}
          </ul>
        )}
      </div>
      <BandBars
        items={[
          { name: taskName, band: b.task, text: grade.feedback.task },
          { name: "Mạch lạc & liên kết", band: b.coherence, text: grade.feedback.coherence },
          { name: "Từ vựng", band: b.lexical, text: grade.feedback.lexical },
          { name: "Ngữ pháp", band: b.grammar, text: grade.feedback.grammar },
        ]}
      />
      <div className="card mt-4">
        <div className="h2 mb-2">Lần sau hãy…</div>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {grade.improvementsVi.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
      <Corrections items={grade.corrections} />
      <WordAdvice used={grade.learnedWordsUsed} suggested={grade.suggestedWords} source={`Viết: Task ${item.task}`} />
      <div className="card mt-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="h2">Bài của bạn, viết lại tốt hơn</div>
          <SpeakButton text={grade.improvedEssay} label="Nghe" />
        </div>
        {showRewrite ? (
          <div className="space-y-3 leading-relaxed">
            {grade.improvedEssay.split(/\n\s*\n/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : (
          <button className="btn-soft w-full" onClick={() => setShowRewrite(true)}>
            Xem bản viết lại
          </button>
        )}
      </div>
      <button className="btn-ghost mt-3 w-full" onClick={run}>
        ↻ Chấm lại (sau khi sửa bài)
      </button>
      <p className="muted mt-2 text-center text-xs">Điểm do AI ước tính để luyện tập, có thể lệch ±0.5–1 band so với giám khảo thật.</p>
    </div>
  );
}
