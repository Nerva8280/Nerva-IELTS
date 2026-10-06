"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LEVELS, type Level, type VocabWord } from "@/content/types";
import { useVocab } from "@/lib/vocab-client";
import { dayLog, getState, touchDay, update, useAppState } from "@/lib/store";
import { isDue, knownCard, newCard, review, intervalLabel, type Grade } from "@/lib/srs";
import { todayStr } from "@/lib/dates";
import { MINUTE_CONFIG } from "@/lib/plan";
import { speakVocab } from "@/lib/tts";
import { DoneBanner, LevelChip, PageHeader, ProgressBar, SpeakButton, WordVoices } from "@/components/ui";

type Mode = "home" | "learn" | "review" | "quiz";

export default function VocabTrainer({ mode }: { mode: Mode }) {
  const vocab = useVocab();
  if (!vocab) return <div className="pt-10 text-center text-slate-400">Đang tải từ vựng…</div>;
  if (mode === "learn") return <Learn vocab={vocab} />;
  if (mode === "review") return <Review vocab={vocab} />;
  if (mode === "quiz") return <Quiz vocab={vocab} />;
  return <Home vocab={vocab} />;
}

function WordDetails({ w }: { w: VocabWord }) {
  return (
    <div className="space-y-3">
      <div className="text-xl font-semibold text-indigo-700">{w.vi}</div>
      <div className="rounded-xl bg-slate-50 p-3">
        <div className="flex items-start gap-2">
          <p className="flex-1 font-medium">{w.example}</p>
          <SpeakButton text={w.example} />
        </div>
        <p className="mt-1 text-sm text-slate-500">{w.exampleVi}</p>
      </div>
      <a
        className="inline-block text-sm text-indigo-600 underline"
        href={`https://youglish.com/pronounce/${encodeURIComponent(w.word)}/english/uk`}
        target="_blank"
        rel="noreferrer"
      >
        Nghe “{w.word}” trong video thật (YouGlish) ↗
      </a>
    </div>
  );
}

function WordHead({ w }: { w: VocabWord }) {
  return (
    <div className="text-center">
      <div className="mb-1 flex justify-center gap-2">
        <LevelChip level={w.level} />
        <span className="chip bg-slate-100 text-slate-600">{w.topic}</span>
      </div>
      <div className="text-4xl font-bold text-slate-900">{w.word}</div>
      <div className="mt-1 text-slate-500">
        {w.ipa} · <i>{w.pos}</i>
      </div>
      <div className="mt-3">
        <WordVoices word={w.word} />
      </div>
    </div>
  );
}

// ---- Learn new words ---------------------------------------------------------

function Learn({ vocab }: { vocab: VocabWord[] }) {
  const s = useAppState();
  const today = todayStr();
  const target = MINUTE_CONFIG[s.roadmap?.minutes ?? 25].newWords;
  const [extra, setExtra] = useState(0);
  const learnedToday = dayLog(s, today).learned;
  const li = LEVELS.indexOf(s.level);
  const queue = useMemo(
    () => vocab.filter((w) => LEVELS.indexOf(w.level) >= li && !s.srs[w.id]).sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level)),
    [vocab, li, s.srs],
  );
  const [show, setShow] = useState(false);
  const w = queue[0];
  const goal = target + extra;

  useEffect(() => {
    if (w) void speakVocab(w.word);
  }, [w]);

  if (learnedToday >= goal || !w)
    return (
      <div>
        <PageHeader title="Học từ mới" back="/vocab" />
        <DoneBanner>
          <div className="text-3xl">✨</div>
          <div className="font-semibold">{w ? `Đã học ${learnedToday} từ mới hôm nay!` : "Bạn đã học hết bộ từ vựng 🎉"}</div>
          <p className="muted">Các từ này sẽ xuất hiện lại trong phần ôn tập vào ngày mai.</p>
          {w && (
            <button className="btn-soft" onClick={() => setExtra((e) => e + 5)}>
              Học thêm 5 từ
            </button>
          )}
        </DoneBanner>
      </div>
    );

  function act(known: boolean) {
    update((st) => {
      st.srs[w.id] = known ? knownCard(today) : review(newCard(today), 2, today);
      if (!known) touchDay(st, today).learned += 1;
    });
    setShow(false);
  }

  return (
    <div>
      <PageHeader title="Học từ mới" back="/vocab" right={<span className="muted">{learnedToday}/{goal}</span>} />
      <ProgressBar value={learnedToday / goal} className="mb-4" />
      <div className="card">
        <WordHead w={w} />
        <div className="mt-5">
          {show ? (
            <WordDetails w={w} />
          ) : (
            <button className="btn-soft w-full" onClick={() => setShow(true)}>
              Xem nghĩa & ví dụ
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button className="btn-ghost py-3" onClick={() => act(true)}>
          Đã biết rồi
        </button>
        <button className="btn-primary py-3" onClick={() => (show ? act(false) : setShow(true))}>
          {show ? "Đã nhớ, tiếp →" : "Học từ này"}
        </button>
      </div>
      <p className="muted mt-3 text-center">Mẹo: đọc to ví dụ 2–3 lần theo giọng mẫu.</p>
    </div>
  );
}

// ---- Spaced-repetition review -----------------------------------------------

function Review({ vocab }: { vocab: VocabWord[] }) {
  const today = todayStr();
  const byId = useMemo(() => new Map(vocab.map((w) => [w.id, w])), [vocab]);
  // Snapshot the due queue when the page opens; "again" cards go to the back.
  const [queue, setQueue] = useState<string[]>(() =>
    Object.entries(getState().srs)
      .filter(([id, c]) => isDue(c, today) && byId.has(id))
      .sort((a, b) => a[1].due.localeCompare(b[1].due))
      .map(([id]) => id),
  );
  const [total] = useState(queue.length);
  const [show, setShow] = useState(false);
  const s = useAppState();
  const id = queue[0];
  const w = id ? byId.get(id) : undefined;
  const card = id ? s.srs[id] : undefined;
  const reverse = !!card && card.reps >= 2 && id.charCodeAt(id.length - 1) % 2 === 0;

  useEffect(() => {
    if (w && !reverse) void speakVocab(w.word);
  }, [w, reverse]);

  useEffect(() => {
    if (!id) update((st) => void (touchDay(st, today).done.includes("review-clear") || touchDay(st, today).done.push("review-clear")));
  }, [id, today]);

  if (!w || !card)
    return (
      <div>
        <PageHeader title="Ôn tập" back="/vocab" />
        <DoneBanner>
          <div className="text-3xl">🔁</div>
          <div className="font-semibold">Không còn từ nào cần ôn hôm nay!</div>
        </DoneBanner>
      </div>
    );

  function grade(g: Grade) {
    update((st) => {
      st.srs[id] = review(st.srs[id], g, today);
      touchDay(st, today).reviewed += 1;
    });
    setQueue((q) => (g === 0 ? [...q.slice(1), id] : q.slice(1)));
    setShow(false);
  }

  const labels: [Grade, string, string][] = [
    [0, "Quên", "bg-rose-100 text-rose-700"],
    [1, "Khó", "bg-amber-100 text-amber-700"],
    [2, "Nhớ", "bg-emerald-100 text-emerald-700"],
    [3, "Dễ", "bg-sky-100 text-sky-700"],
  ];

  return (
    <div>
      <PageHeader title="Ôn tập" back="/vocab" right={<span className="muted">còn {queue.length}</span>} />
      <ProgressBar value={total ? 1 - queue.length / total : 1} className="mb-4" />
      <div className="card min-h-72">
        {reverse && !show ? (
          <div className="py-6 text-center">
            <div className="muted mb-2">Từ tiếng Anh nào có nghĩa:</div>
            <div className="text-2xl font-bold text-indigo-700">{w.vi}</div>
            <div className="muted mt-2">({w.pos})</div>
          </div>
        ) : (
          <WordHead w={w} />
        )}
        {show && (
          <div className="mt-5">
            {reverse && <WordHead w={w} />}
            <div className="mt-4">
              <WordDetails w={w} />
            </div>
          </div>
        )}
      </div>
      {show ? (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {labels.map(([g, label, cls]) => (
            <button key={g} onClick={() => grade(g)} className={`btn flex-col gap-0 py-2 ${cls}`}>
              <span>{label}</span>
              <span className="text-[11px] font-normal opacity-80">{intervalLabel(card, g, today)}</span>
            </button>
          ))}
        </div>
      ) : (
        <button className="btn-primary mt-4 w-full py-3" onClick={() => setShow(true)}>
          Hiện đáp án
        </button>
      )}
    </div>
  );
}

// ---- Quick meaning quiz -------------------------------------------------------

function Quiz({ vocab }: { vocab: VocabWord[] }) {
  const today = todayStr();
  const [items] = useState(() => {
    const srs = getState().srs;
    const pool = vocab.filter((w) => srs[w.id] && !srs[w.id].known);
    const pick = [...pool].sort(() => Math.random() - 0.5).slice(0, 15);
    return pick.map((w) => {
      const others = vocab.filter((x) => x.id !== w.id && x.level === w.level && x.vi !== w.vi).sort(() => Math.random() - 0.5).slice(0, 3);
      const options = [...others.map((o) => o.vi), w.vi].sort(() => Math.random() - 0.5);
      return { w, options, answer: options.indexOf(w.vi) };
    });
  });
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [wrong, setWrong] = useState<VocabWord[]>([]);
  const finished = i >= items.length;

  useEffect(() => {
    if (finished && items.length)
      update((st) => {
        const log = touchDay(st, today);
        if (!log.done.includes("quiz")) log.done.push("quiz");
        for (const w of wrong) if (st.srs[w.id]) st.srs[w.id] = { ...st.srs[w.id], due: today };
      });
  }, [finished, items.length, today, wrong]);

  if (items.length < 4)
    return (
      <div>
        <PageHeader title="Kiểm tra nhanh" back="/vocab" />
        <div className="card text-center text-slate-600">Bạn cần học ít nhất vài từ trước khi làm bài kiểm tra.</div>
        <Link href="/vocab?mode=learn" className="btn-primary mt-4 w-full">
          Học từ mới
        </Link>
      </div>
    );

  if (finished)
    return (
      <div>
        <PageHeader title="Kiểm tra nhanh" back="/vocab" />
        <DoneBanner>
          <div className="text-4xl font-bold text-indigo-600">
            {right}/{items.length}
          </div>
          {wrong.length > 0 && (
            <div className="w-full text-left">
              <div className="mb-1 font-semibold">Từ cần ôn lại (đã đưa vào lượt ôn hôm nay):</div>
              {wrong.map((w) => (
                <div key={w.id} className="text-sm">
                  <b>{w.word}</b>: {w.vi}
                </div>
              ))}
            </div>
          )}
        </DoneBanner>
      </div>
    );

  const it = items[i];
  return (
    <div>
      <PageHeader title="Kiểm tra nhanh" back="/vocab" right={<span className="muted">{i + 1}/{items.length}</span>} />
      <ProgressBar value={i / items.length} className="mb-4" />
      <div className="card text-center">
        <div className="text-3xl font-bold">{it.w.word}</div>
        <div className="mt-1 text-slate-500">{it.w.ipa}</div>
        <button className="mt-2 rounded-full bg-indigo-50 px-2.5 py-1 text-sm text-indigo-700" onClick={() => speakVocab(it.w.word)} aria-label="Nghe">
          🔊
        </button>
      </div>
      <div className="mt-4 grid gap-2">
        {it.options.map((o, k) => (
          <button
            key={k}
            disabled={picked !== null}
            onClick={() => {
              setPicked(k);
              if (k === it.answer) setRight((r) => r + 1);
              else setWrong((x) => [...x, it.w]);
              setTimeout(() => {
                setPicked(null);
                setI((n) => n + 1);
              }, k === it.answer ? 600 : 1500);
            }}
            className={`rounded-xl border px-4 py-3 text-left transition disabled:pointer-events-none ${
              picked !== null && k === it.answer ? "border-emerald-500 bg-emerald-50" : picked === k ? "border-rose-400 bg-rose-50" : "border-slate-200 bg-white"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Overview & word list ----------------------------------------------------

function Home({ vocab }: { vocab: VocabWord[] }) {
  const s = useAppState();
  const today = todayStr();
  const [level, setLevel] = useState<Level>(s.level);
  const [q, setQ] = useState("");
  const due = Object.values(s.srs).filter((c) => isDue(c, today)).length;
  const learned = Object.values(s.srs).length;
  const list = vocab.filter((w) => w.level === level && (!q || w.word.toLowerCase().includes(q.toLowerCase()) || w.vi.toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageHeader title="Từ vựng" />
      <div className="grid grid-cols-3 gap-2">
        <Link href="/vocab?mode=review" className="card text-center">
          <div className="text-2xl">🔁</div>
          <div className="text-sm font-semibold">Ôn tập</div>
          <div className="text-xs text-slate-500">{due} từ đến hạn</div>
        </Link>
        <Link href="/vocab?mode=learn" className="card text-center">
          <div className="text-2xl">✨</div>
          <div className="text-sm font-semibold">Học mới</div>
          <div className="text-xs text-slate-500">{learned}/{vocab.length}</div>
        </Link>
        <Link href="/vocab?mode=quiz" className="card text-center">
          <div className="text-2xl">📝</div>
          <div className="text-sm font-semibold">Kiểm tra</div>
          <div className="text-xs text-slate-500">15 câu</div>
        </Link>
      </div>

      <div className="mt-5 flex gap-1">
        {LEVELS.map((l) => (
          <button key={l} onClick={() => setLevel(l)} className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${level === l ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
            {l}
          </button>
        ))}
      </div>
      <input className="input mt-3" placeholder="Tìm từ hoặc nghĩa…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
        {list.map((w) => {
          const c = s.srs[w.id];
          return (
            <div key={w.id} className="flex items-center gap-3 px-4 py-2.5">
              <button onClick={() => speakVocab(w.word)} className="text-lg" aria-label="Nghe">
                🔊
              </button>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {w.word} <span className="text-xs font-normal text-slate-400">{w.ipa}</span>
                </div>
                <div className="truncate text-sm text-slate-500">{w.vi}</div>
              </div>
              {c && <span className={`chip ${c.known ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"}`}>{c.known ? "đã biết" : "đang học"}</span>}
            </div>
          );
        })}
        {!list.length && <div className="p-4 text-center text-slate-400">Không có từ nào</div>}
      </div>
    </div>
  );
}
