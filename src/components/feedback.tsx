"use client";
// Pieces shared by the AI feedback screens (speaking and writing).
import { useState } from "react";
import { addMyWord } from "@/lib/notebook";
import { useVocab } from "@/lib/vocab-client";
import { ProgressBar } from "./ui";

export function bandColor(b: number) {
  return b >= 7 ? "text-emerald-600" : b >= 5.5 ? "text-indigo-600" : b >= 4 ? "text-amber-600" : "text-rose-600";
}

export function BandBars({ items }: { items: { name: string; band: number; text: string }[] }) {
  return (
    <div className="card mt-4 space-y-4">
      {items.map((c) => (
        <div key={c.name}>
          <div className="mb-1 flex justify-between text-sm font-semibold">
            <span>{c.name}</span>
            <span className={bandColor(c.band)}>{c.band.toFixed(1)}</span>
          </div>
          <ProgressBar value={c.band / 9} />
          <p className="mt-1.5 text-sm text-slate-600">{c.text}</p>
        </div>
      ))}
    </div>
  );
}

export function Corrections({ items }: { items: { original: string; corrected: string; explanationVi: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="card mt-4">
      <div className="h2 mb-1">Sửa lỗi</div>
      <p className="mb-2 text-xs text-slate-400">Đã tự lưu vào 📒 Sổ lỗi sai để ôn lại.</p>
      <div className="space-y-3">
        {items.map((c, i) => (
          <div key={i} className="text-sm">
            <div className="text-rose-600 line-through">{c.original}</div>
            <div className="font-semibold text-emerald-700">→ {c.corrected}</div>
            <div className="text-slate-500">{c.explanationVi}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Learned words the learner used + words to try, each addable to "Từ của tôi". */
export function WordAdvice({ used, suggested, source }: { used: string[]; suggested: { word: string; howVi: string }[]; source: string }) {
  const vocab = useVocab();
  const [added, setAdded] = useState<Record<string, string>>({});
  return (
    <div className="card mt-4">
      <div className="h2 mb-2">Từ vựng</div>
      {used.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-slate-500">Từ đã học bạn dùng được:</span>
          {used.map((w) => (
            <span key={w} className="chip bg-emerald-100 text-emerald-700">
              ✓ {w}
            </span>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-sm text-slate-500">Lần này bạn chưa dùng từ nào trong danh sách đã học. Thử áp dụng các từ dưới đây nhé!</p>
      )}
      <div className="space-y-2">
        {suggested.map((w) => (
          <div key={w.word} className="flex items-start gap-2 text-sm">
            <div className="flex-1">
              <b className="text-indigo-700">{w.word}</b>: {w.howVi}
            </div>
            <button
              className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 disabled:opacity-60"
              disabled={!!added[w.word]}
              onClick={() => setAdded((a) => ({ ...a, [w.word]: addMyWord(w.word, w.howVi, source, vocab) }))}
            >
              {added[w.word] === "exists" ? "Đã có" : added[w.word] ? "✓ Đã thêm" : "+ Học từ này"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
