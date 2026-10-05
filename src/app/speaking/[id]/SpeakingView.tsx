"use client";
import { useEffect, useRef, useState } from "react";
import type { SpeakingTopic } from "@/content/types";
import { markDone, getState } from "@/lib/store";
import { listen, recognitionSupported, type Listening } from "@/lib/speech";
import PronSelfCheck from "@/components/PronSelfCheck";
import { DoneBanner, fmtTime, LevelChip, PageHeader, SpeakButton, useRecorder, useTimer } from "@/components/ui";

/** Record an answer, play it back, and optionally see what speech recognition heard. */
function AnswerBox({ maxSec }: { maxSec: number }) {
  const rec = useRecorder();
  const [sec, setSec] = useTimer(rec.recording);
  const [heard, setHeard] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const l = useRef<Listening | null>(null);

  const { recording, stop } = rec;
  useEffect(() => {
    if (recording && sec >= maxSec) stop();
  }, [recording, stop, sec, maxSec]);

  async function transcribe() {
    if (listening) return l.current?.stop();
    setHeard(null);
    setListening(true);
    l.current = listen(getState().settings.accent, true);
    try {
      setHeard(await l.current.result);
    } catch {
      setHeard("");
    }
    setListening(false);
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {rec.recording ? (
          <button className="btn bg-rose-600 text-white" onClick={rec.stop}>
            ⏹ Dừng ({fmtTime(sec)}/{fmtTime(maxSec)})
          </button>
        ) : (
          <button
            className="btn-soft"
            onClick={() => {
              setSec(0);
              void rec.start();
            }}
          >
            🎙 Ghi âm câu trả lời
          </button>
        )}
        {recognitionSupported() && !rec.recording && (
          <button className={listening ? "btn bg-rose-600 text-white" : "btn-ghost"} onClick={transcribe}>
            {listening ? "⏹ Dừng nghe" : "📝 Nói để xem máy nghe được gì"}
          </button>
        )}
      </div>
      {rec.error && <p className="text-sm text-rose-600">{rec.error}</p>}
      {rec.url && !rec.recording && <audio controls src={rec.url} className="w-full" />}
      {heard !== null && (
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          {heard ? (
            <>
              <div className="mb-1 text-xs font-semibold text-slate-500">Máy nghe được ({heard.split(/\s+/).length} từ):</div>
              {heard}
            </>
          ) : (
            <span className="text-slate-500">Không nghe được gì, hãy thử nói to và rõ hơn.</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function SpeakingView({ item }: { item: SpeakingTopic }) {
  const [showSample, setShowSample] = useState(false);
  const [done, setDone] = useState(false);
  const [prep, setPrep] = useState(false);
  const [prepSec] = useTimer(prep);
  const isP2 = item.part === 2;

  return (
    <div>
      <PageHeader title={item.topic} back="/practice" right={<LevelChip level={item.level} />} />
      <div className="mb-3 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">
        {item.part === 1 && "Part 1: trả lời 2–3 câu cho mỗi câu hỏi (~20–30 giây). Trả lời thẳng, rồi thêm lý do/ví dụ."}
        {isP2 && "Part 2: 1 phút chuẩn bị (ghi từ khóa), sau đó nói liên tục 1–2 phút theo các gợi ý."}
        {item.part === 3 && "Part 3: thảo luận sâu (~40–60 giây/câu). Nêu quan điểm → giải thích → ví dụ → mặt còn lại."}
      </div>

      {isP2 ? (
        <div className="card">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-lg font-semibold">{item.questions[0]}</p>
            <SpeakButton text={item.questions[0]} />
          </div>
          {item.cueCard && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
              {item.cueCard.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            {!prep ? (
              <button className="btn-ghost" onClick={() => setPrep(true)}>
                ⏱ Bắt đầu 1 phút chuẩn bị
              </button>
            ) : (
              <div className={`font-semibold ${prepSec >= 60 ? "text-emerald-600" : "text-amber-600"}`}>
                {prepSec >= 60 ? "Hết giờ chuẩn bị, bắt đầu nói!" : `Chuẩn bị: ${60 - prepSec}s`}
              </div>
            )}
          </div>
          <AnswerBox maxSec={120} />
        </div>
      ) : (
        <div className="space-y-3">
          {item.questions.map((q, i) => (
            <div key={i} className="card">
              <div className="flex items-start gap-2">
                <span className="font-bold text-indigo-400">{i + 1}.</span>
                <p className="flex-1 font-medium">{q}</p>
                <SpeakButton text={q} gender={i % 2 ? "m" : "f"} />
              </div>
              <AnswerBox maxSec={item.part === 3 ? 90 : 45} />
            </div>
          ))}
        </div>
      )}

      <button className="btn-ghost mt-4 w-full" onClick={() => setShowSample((x) => !x)}>
        {showSample ? "Ẩn" : "Xem"} câu trả lời mẫu (band 7)
      </button>
      {showSample && (
        <div className="card mt-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="muted">Trả lời cho: “{item.questions[0]}”</div>
            <SpeakButton text={item.sampleAnswer} label="Nghe" />
          </div>
          <p className="leading-relaxed">{item.sampleAnswer}</p>
          <div className="border-t border-slate-100 pt-3 text-sm">
            <div className="mb-1 font-semibold">Cụm từ hữu ích</div>
            {item.usefulPhrases.map((p) => (
              <div key={p.en} className="flex items-center gap-2 py-0.5">
                <SpeakButton text={p.en} />
                <span>
                  <b>{p.en}</b>: {p.vi}
                </span>
              </div>
            ))}
          </div>
          <p className="muted">Gợi ý: dùng bài mẫu để shadowing: nghe từng câu rồi nói đuổi theo.</p>
        </div>
      )}

      {!done ? (
        <button
          className="btn-primary mt-4 w-full"
          onClick={() => {
            markDone(item.id);
            setDone(true);
          }}
        >
          Hoàn thành bài nói
        </button>
      ) : (
        <>
          <PronSelfCheck source={item.id} />
          <DoneBanner>
            <div className="font-semibold">Tốt lắm! Nghe lại bản ghi âm để tự nhận ra lỗi phát âm và ngập ngừng.</div>
          </DoneBanner>
        </>
      )}
    </div>
  );
}
