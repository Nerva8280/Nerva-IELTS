"use client";
import { useState } from "react";
import type { TalkQuestion, TalkTopic } from "@/content/types";
import { useAppState, type TalkRecord } from "@/lib/store";
import { LevelChip, PageHeader } from "@/components/ui";
import TalkPractice from "./TalkPractice";
import MockSpeaking from "./MockSpeaking";

export interface ActiveQuestion {
  topic: TalkTopic;
  q: string;
  part: 1 | 2 | 3;
  qid?: string;
  hintVi?: string;
  cueCard?: string[]; // Part 2 "You should say" points
}

function bestBand(talks: TalkRecord[] | undefined, match: (t: TalkRecord) => boolean) {
  const xs = (talks ?? []).filter(match).map((t) => t.bands.overall);
  return xs.length ? Math.max(...xs) : null;
}

export interface CueCard {
  id: string;
  title: string;
  points: string[];
  part3: string[]; // follow-up discussion questions on the same theme
}

// Pseudo topic for Part 2 practice, so results are grouped like the others.
export const PART2_TOPIC: TalkTopic = { id: "part2", topic: "Part 2", topicVi: "Part 2 · Thẻ đề", icon: "🃏", questions: [] };

export default function TalkHome({ topics, cards }: { topics: TalkTopic[]; cards: CueCard[] }) {
  const s = useAppState();
  const [topic, setTopic] = useState<TalkTopic | null>(null);
  const [active, setActive] = useState<ActiveQuestion | null>(null);
  const [part, setPart] = useState<0 | 1 | 3>(0);
  const [showCards, setShowCards] = useState(false);
  const [mock, setMock] = useState(false);

  const pickCard = (c: CueCard) => setActive({ topic: PART2_TOPIC, q: c.title, part: 2, qid: c.id, cueCard: c.points, hintVi: "Dùng 1 phút ghi từ khóa cho mỗi gạch đầu dòng. Nói theo thứ tự các ý, kể chi tiết, và kết bằng ý “explain why…”." });
  const randomCard = () => pickCard(cards[Math.floor(Math.random() * cards.length)]);

  const pick = (t: TalkTopic, q: TalkQuestion) => setActive({ topic: t, q: q.q, part: q.part, qid: q.id, hintVi: q.hintVi });
  const random = (t: TalkTopic) => {
    const pool = t.questions.filter((q) => !part || q.part === part);
    const fresh = pool.filter((q) => !bestBand(s.talks, (r) => r.qid === q.id));
    const from = fresh.length ? fresh : pool;
    pick(t, from[Math.floor(Math.random() * from.length)]);
  };

  if (mock) return <MockSpeaking topics={topics} cards={cards} onExit={() => setMock(false)} />;

  if (active)
    return (
      <TalkPractice
        key={active.q}
        active={active}
        onBack={() => setActive(null)}
        onNext={(next) => (next ? setActive(next) : active.topic.id === PART2_TOPIC.id ? randomCard() : random(active.topic))}
      />
    );

  if (topic) {
    const list = topic.questions.filter((q) => !part || q.part === part);
    return (
      <div>
        <PageHeader
          title={`${topic.icon} ${topic.topicVi}`}
          right={
            <button className="btn-ghost px-3 py-1.5" onClick={() => setTopic(null)}>
              Chủ đề khác
            </button>
          }
        />
        <button className="btn-primary mb-4 w-full py-3 text-base" onClick={() => random(topic)}>
          🎲 Câu hỏi ngẫu nhiên
        </button>
        <div className="mb-3 flex gap-2">
          {([0, 1, 3] as const).map((p) => (
            <button key={p} onClick={() => setPart(p)} className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${part === p ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
              {p === 0 ? "Tất cả" : p === 1 ? "Part 1 · đời thường" : "Part 3 · thảo luận"}
            </button>
          ))}
        </div>
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
          {list.map((q) => {
            const b = bestBand(s.talks, (r) => r.qid === q.id);
            return (
              <button key={q.id} onClick={() => pick(topic, q)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{q.q}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                    <LevelChip level={q.level} /> Part {q.part}
                  </div>
                </div>
                {b !== null ? <span className="chip bg-emerald-100 text-emerald-700">{b.toFixed(1)}</span> : <span className="text-slate-300">→</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const recent = (s.talks ?? []).slice(-10);
  const avg = recent.length ? recent.reduce((a, t) => a + t.bands.overall, 0) / recent.length : null;
  return (
    <div>
      <PageHeader title="Luyện phản xạ nói" />
      <div className="card mb-4 text-sm leading-relaxed">
        <p>
          Chọn chủ đề → nghe câu hỏi như đang nói chuyện với giám khảo → trả lời ngay bằng giọng nói. AI nghe bản ghi và chấm theo 4 tiêu chí IELTS: <b>trôi chảy, từ vựng, ngữ pháp, phát âm</b>, đồng thời gợi ý cách dùng các từ bạn đã học.
        </p>
        {avg !== null && (
          <p className="mt-2 text-slate-600">
            Band trung bình {recent.length} câu gần nhất: <b className="text-indigo-600">{avg.toFixed(1)}</b>
          </p>
        )}
      </div>
      <button onClick={() => setMock(true)} className="card mb-3 flex w-full items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-left text-white ring-0">
        <span className="text-3xl">🎤</span>
        <div className="flex-1">
          <div className="font-semibold">Thi thử Speaking đầy đủ</div>
          <div className="text-sm text-indigo-100">Part 1 → Part 2 → Part 3 như phòng thi · khoảng 12 phút · chấm band tổng</div>
        </div>
        <span>→</span>
      </button>
      <button onClick={() => setShowCards((x) => !x)} className="card mb-3 flex w-full items-center gap-3 text-left">
        <span className="text-3xl">🃏</span>
        <div className="flex-1">
          <div className="font-semibold">Part 2: Thẻ đề (nói 1–2 phút)</div>
          <div className="text-sm text-slate-500">{cards.length} thẻ đề · 1 phút chuẩn bị có ghi chú</div>
        </div>
        <span className="text-slate-400">{showCards ? "▲" : "▼"}</span>
      </button>
      {showCards && (
        <div className="mb-4 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
          <button className="w-full bg-indigo-50 px-4 py-2.5 text-left text-sm font-semibold text-indigo-700" onClick={randomCard}>
            🎲 Thẻ đề ngẫu nhiên
          </button>
          {cards.map((c) => {
            const b = bestBand(s.talks, (r) => r.qid === c.id);
            return (
              <button key={c.id} onClick={() => pickCard(c)} className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left hover:bg-slate-50">
                <span className="flex-1 font-medium">{c.title}</span>
                {b !== null ? <span className="chip bg-emerald-100 text-emerald-700">{b.toFixed(1)}</span> : <span className="text-slate-300">→</span>}
              </button>
            );
          })}
        </div>
      )}
      <h2 className="h2 mb-2 mt-5">Part 1 & 3 theo chủ đề</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {topics.map((t) => {
          const done = (s.talks ?? []).filter((r) => r.topic === t.id).length;
          return (
            <button key={t.id} onClick={() => setTopic(t)} className="card flex flex-col items-start gap-1 text-left hover:ring-indigo-300">
              <span className="text-2xl">{t.icon}</span>
              <span className="font-semibold">{t.topicVi}</span>
              <span className="text-xs text-slate-500">
                {t.topic} · {done ? `${done} lần luyện` : `${t.questions.length} câu`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
