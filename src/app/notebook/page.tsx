"use client";
import Link from "next/link";
import { useState } from "react";
import { update, useAppState } from "@/lib/store";
import type { Mistake, MistakeKind } from "@/lib/notebook";
import { speakVocab } from "@/lib/tts";
import { PageHeader, ProgressBar } from "@/components/ui";

const TABS: { id: "review" | MistakeKind | "words" | "mastered"; label: string }[] = [
  { id: "review", label: "Cần ôn" },
  { id: "grammar", label: "Ngữ pháp" },
  { id: "vocab", label: "Dùng từ" },
  { id: "pronunciation", label: "Phát âm" },
  { id: "exercise", label: "Bài tập sai" },
  { id: "words", label: "Từ của tôi" },
  { id: "mastered", label: "Đã nắm" },
];

const KIND_VI: Record<MistakeKind, string> = { grammar: "Ngữ pháp", vocab: "Dùng từ", pronunciation: "Phát âm", exercise: "Bài tập" };

function MistakeRow({ m }: { m: Mistake }) {
  return (
    <div className="px-4 py-3 text-sm">
      <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
        <span className="chip bg-slate-100 text-slate-600">{KIND_VI[m.kind]}</span>
        {m.source} · {m.date.slice(8)}/{m.date.slice(5, 7)}
        <button className="ml-auto text-slate-300 hover:text-rose-500" onClick={() => update((s) => void (s.mistakes = (s.mistakes ?? []).filter((x) => x.id !== m.id)))} aria-label="Xóa">
          ✕
        </button>
      </div>
      {m.kind === "pronunciation" ? (
        <div className="flex items-start gap-2">
          <button className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700" onClick={() => speakVocab(m.original)} aria-label="Nghe">
            🔊
          </button>
          <div>
            <b>{m.original}</b>: {m.explanationVi}
          </div>
        </div>
      ) : (
        <>
          <div className="text-rose-600 line-through decoration-rose-300">{m.original}</div>
          <div className="font-semibold text-emerald-700">→ {m.corrected}</div>
          {m.explanationVi && <div className="text-slate-500">{m.explanationVi}</div>}
        </>
      )}
    </div>
  );
}

/** Flashcard review: see the mistake, try to fix it, then reveal the correction. */
function Review({ items, onExit }: { items: Mistake[]; onExit: () => void }) {
  const [queue, setQueue] = useState(items.map((m) => m.id));
  const [show, setShow] = useState(false);
  const s = useAppState();
  const m = (s.mistakes ?? []).find((x) => x.id === queue[0]);
  if (!m)
    return (
      <div className="card text-center">
        <div className="text-3xl">🎉</div>
        <div className="mt-1 font-semibold">Ôn xong lượt này!</div>
        <button className="btn-primary mt-3" onClick={onExit}>
          Về Sổ lỗi sai
        </button>
      </div>
    );
  const done = (mastered: boolean) => {
    update((st) => {
      const x = (st.mistakes ?? []).find((y) => y.id === m.id);
      if (x) {
        x.reviews += 1;
        x.mastered = mastered;
      }
    });
    setQueue((q) => (mastered ? q.slice(1) : [...q.slice(1), m.id]));
    setShow(false);
  };
  return (
    <div>
      <ProgressBar value={1 - queue.length / items.length} className="mb-3" />
      <div className="card min-h-56">
        <div className="mb-3 text-xs text-slate-400">
          {KIND_VI[m.kind]} · {m.source}
        </div>
        {m.kind === "pronunciation" ? (
          <>
            <p className="text-sm text-slate-500">Bạn đã phát âm chưa chuẩn từ:</p>
            <div className="my-2 text-3xl font-bold">{m.original}</div>
            <button className="btn-soft" onClick={() => speakVocab(m.original)}>
              🔊 Nghe mẫu
            </button>
            <p className="mt-2 text-sm text-slate-500">Đọc to 3 lần theo mẫu, rồi bấm hiện lưu ý.</p>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500">{m.kind === "exercise" ? "Câu bạn làm sai. Đáp án đúng là gì?" : "Câu này sai ở đâu? Hãy tự sửa trong đầu:"}</p>
            <p className="mt-2 text-lg font-semibold text-rose-600">{m.original}</p>
          </>
        )}
        {show && (
          <div className="mt-4 rounded-xl bg-emerald-50 p-3">
            {m.kind !== "pronunciation" && <div className="text-lg font-semibold text-emerald-700">→ {m.corrected}</div>}
            {m.explanationVi && <div className="mt-1 text-sm text-slate-600">{m.explanationVi}</div>}
          </div>
        )}
      </div>
      {show ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="btn bg-amber-100 py-3 text-amber-800" onClick={() => done(false)}>
            Chưa nhớ, ôn lại
          </button>
          <button className="btn bg-emerald-100 py-3 text-emerald-800" onClick={() => done(true)}>
            ✓ Đã nắm
          </button>
        </div>
      ) : (
        <button className="btn-primary mt-3 w-full py-3" onClick={() => setShow(true)}>
          Hiện đáp án
        </button>
      )}
      <button className="btn-ghost mt-2 w-full" onClick={onExit}>
        Dừng ôn
      </button>
    </div>
  );
}

export default function NotebookPage() {
  const s = useAppState();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("review");
  const [reviewing, setReviewing] = useState<Mistake[] | null>(null);
  const all = [...(s.mistakes ?? [])].reverse();
  const open = all.filter((m) => !m.mastered);
  const list =
    tab === "review" ? open : tab === "mastered" ? all.filter((m) => m.mastered) : tab === "words" ? [] : open.filter((m) => m.kind === tab);
  const myWords = [...(s.myWords ?? [])].reverse();

  if (reviewing)
    return (
      <div>
        <PageHeader title="Ôn lỗi sai" />
        <Review items={reviewing} onExit={() => setReviewing(null)} />
      </div>
    );

  return (
    <div>
      <PageHeader title="📒 Sổ lỗi sai" />
      <div className="card mb-4 text-sm leading-relaxed text-slate-600">
        Mọi lỗi AI đã sửa khi bạn <b>nói</b> và <b>viết</b>, các câu làm sai trong <b>bài tập</b>, và những từ bạn chọn <b>“+ Học từ này”</b> đều được gom ở đây. Ôn lại đến khi “Đã nắm”: lỗi lặp lại là thứ kéo band xuống nhiều nhất.
      </div>
      {open.length > 0 && (
        <button className="btn-primary mb-4 w-full py-3" onClick={() => setReviewing(open.slice(0, 15))}>
          🔁 Ôn {Math.min(15, open.length)} lỗi (còn {open.length} lỗi chưa nắm)
        </button>
      )}
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${tab === t.id ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
          >
            {t.label}
            {t.id === "words" ? ` (${myWords.length})` : t.id === "review" ? ` (${open.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "words" ? (
        <>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
            {myWords.map((w) => (
              <div key={w.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                <button onClick={() => speakVocab(w.word)} aria-label="Nghe">
                  🔊
                </button>
                <div className="min-w-0 flex-1">
                  <b>{w.word}</b>
                  <div className="text-slate-500">{w.note}</div>
                  <div className="text-xs text-slate-400">{w.source}</div>
                </div>
                <button
                  className="text-slate-300 hover:text-rose-500"
                  aria-label="Xóa"
                  onClick={() =>
                    update((st) => {
                      st.myWords = (st.myWords ?? []).filter((x) => x.id !== w.id);
                      delete st.srs[w.id];
                    })
                  }
                >
                  ✕
                </button>
              </div>
            ))}
            {!myWords.length && <div className="p-4 text-center text-sm text-slate-400">Chưa có từ nào. Bấm “+ Học từ này” trong phần nhận xét của AI để thêm.</div>}
          </div>
          {myWords.length > 0 && (
            <Link href="/vocab?mode=review" className="btn-soft mt-3 w-full">
              Ôn bằng thẻ từ vựng
            </Link>
          )}
        </>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
          {list.map((m) => (
            <MistakeRow key={m.id} m={m} />
          ))}
          {!list.length && <div className="p-4 text-center text-sm text-slate-400">Không có mục nào ở đây.</div>}
        </div>
      )}
    </div>
  );
}
