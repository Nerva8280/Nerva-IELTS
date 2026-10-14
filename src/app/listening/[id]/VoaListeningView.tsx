"use client";
import { useEffect, useRef, useState } from "react";
import type { VoaListening } from "@/content/types";
import { getState, markDone } from "@/lib/store";
import { stopSpeaking } from "@/lib/tts";
import QuestionSet from "@/components/QuestionSet";
import { DoneBanner, LevelChip, PageHeader, fmtTime } from "@/components/ui";

const RATES = [0.75, 0.9, 1, 1.1];

/** Player for a real VOA recording: play/pause, back 10 s, speed, seek. */
function VoaPlayer({ src }: { src: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(() => RATES.reduce((a, b) => (Math.abs(b - getState().settings.rate) < Math.abs(a - getState().settings.rate) ? b : a)));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = rate;
  }, [rate]);

  function toggle() {
    const a = audio.current;
    if (!a) return;
    stopSpeaking();
    if (a.paused) void a.play().catch(() => setError(true));
    else a.pause();
  }

  return (
    <div className="card">
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDur(e.currentTarget.duration);
          e.currentTarget.playbackRate = rate;
        }}
        onError={() => setError(true)}
      />
      <div className="flex items-center gap-2">
        <button className="btn-primary flex-1 py-3" onClick={toggle}>
          {playing ? "⏸ Dừng" : t > 0 ? "▶ Nghe tiếp" : "▶ Bắt đầu nghe"}
        </button>
        <button className="btn-ghost py-3" onClick={() => audio.current && (audio.current.currentTime = Math.max(0, audio.current.currentTime - 10))} aria-label="Lùi 10 giây">
          ⟲ 10s
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={dur || 0}
        step={1}
        value={t}
        onChange={(e) => audio.current && (audio.current.currentTime = Number(e.target.value))}
        className="mt-3 w-full"
        aria-label="Vị trí"
      />
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {fmtTime(Math.floor(t))} / {dur ? fmtTime(Math.floor(dur)) : "--:--"}
        </span>
        <div className="flex rounded-lg ring-1 ring-slate-200">
          {RATES.map((r) => (
            <button key={r} onClick={() => setRate(r)} className={`rounded-lg px-2 py-1 font-semibold ${rate === r ? "bg-indigo-600 text-white" : "text-slate-600"}`}>
              {r}×
            </button>
          ))}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">Không tải được âm thanh từ VOA. Kiểm tra mạng rồi thử lại.</p>}
    </div>
  );
}

export default function VoaListeningView({ item }: { item: VoaListening }) {
  const [result, setResult] = useState<[number, number] | null>(null);
  const [transcript, setTranscript] = useState(false);
  const words = item.transcript.join(" ").split(/\s+/).length;
  return (
    <div>
      <PageHeader title={item.title} back="/practice" right={<LevelChip level={item.level} />} />
      <p className="muted mb-1">
        🗣️ Giọng thật · {item.section} · khoảng {Math.round(words / 130)} phút
      </p>
      <p className="mb-3 text-sm text-slate-600">{item.contextVi}</p>
      <div className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
        Mẹo: đọc lướt câu hỏi trước, nghe một lượt không dừng, rồi trả lời. Câu hỏi đi theo thứ tự bài nghe.
      </div>
      <VoaPlayer src={item.audio} />
      <h2 className="h2 mb-2 mt-5">Câu hỏi</h2>
      <QuestionSet
        questions={item.questions}
        source={`Listening: ${item.title}`}
        onSubmit={(score, total) => {
          markDone(item.id, score, total);
          setResult([score, total]);
          setTranscript(true);
        }}
      />
      <button className="btn-ghost mt-4 w-full" onClick={() => setTranscript((x) => !x)}>
        {transcript ? "Ẩn" : "Hiện"} lời bài nghe {!result && "(nên làm bài xong rồi xem)"}
      </button>
      {transcript && (
        <div className="card mt-2 space-y-3 leading-relaxed">
          {item.transcript.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <div className="border-t border-slate-100 pt-3 text-sm">
            <div className="mb-1 font-semibold">Từ vựng</div>
            {item.vocab.map((v) => (
              <div key={v.word}>
                <b>{v.word}</b>: {v.vi}
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-400">
        Nguồn:{" "}
        <a className="underline" href={item.url} target="_blank" rel="noreferrer">
          VOA Learning English
        </a>{" "}
        · {item.credit} · nội dung do VOA sản xuất thuộc phạm vi công cộng (public domain).
      </p>
      {result && (
        <DoneBanner>
          <div className="font-semibold">
            {result[0]}/{result[1]} câu đúng. Nghe lại kèm lời bài để bắt những chỗ chưa nghe ra.
          </div>
        </DoneBanner>
      )}
    </div>
  );
}
