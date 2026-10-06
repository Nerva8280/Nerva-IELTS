"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Level } from "@/content/types";
import { humanAudio, playUrl, speak, speakWord, stopSpeaking } from "@/lib/tts";
import { MAIN_VOICES, VOICES, type VoiceId } from "@/lib/audio-key";

export function PageHeader({ title, back, right }: { title: string; back?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {back && (
        <Link href={back} className="-ml-2 rounded-full px-2 py-1 text-xl text-slate-500 hover:bg-slate-200/60" aria-label="Quay lại">
          ←
        </Link>
      )}
      <h1 className="h1 flex-1">{title}</h1>
      {right}
    </div>
  );
}

const LEVEL_COLORS: Record<Level, string> = {
  A1: "bg-emerald-100 text-emerald-700",
  A2: "bg-teal-100 text-teal-700",
  B1: "bg-sky-100 text-sky-700",
  B2: "bg-violet-100 text-violet-700",
  C1: "bg-rose-100 text-rose-700",
};

export function LevelChip({ level }: { level: Level }) {
  return <span className={`chip ${LEVEL_COLORS[level]}`}>{level}</span>;
}

export function SpeakButton({
  text,
  gender,
  rate,
  voice,
  className = "",
  label,
  human,
}: {
  text: string;
  gender?: "f" | "m";
  rate?: number;
  voice?: VoiceId;
  className?: string;
  label?: string;
  human?: boolean; // prefer a real human recording (single words)
}) {
  const [on, setOn] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-sm font-medium text-indigo-700 hover:bg-indigo-100 ${className}`}
      onClick={async (e) => {
        e.stopPropagation();
        if (on) {
          stopSpeaking();
          setOn(false);
          return;
        }
        setOn(true);
        await (human ? speakWord(text, { gender, rate, voice }) : speak(text, { gender, rate, voice }));
        setOn(false);
      }}
      aria-label="Nghe"
    >
      {on ? "⏹" : "🔊"}
      {label && <span>{label}</span>}
    </button>
  );
}

/** Hear a word in four neural voices, a real human recording (when one exists) and slowly. */
export function WordVoices({ word }: { word: string }) {
  const [human, setHuman] = useState<string | null | undefined>(undefined);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    humanAudio(word).then((h) => {
      if (alive) setHuman(h.uk ?? h.us ?? h.other ?? null);
    });
    return () => {
      alive = false;
    };
  }, [word]);

  async function run(key: string, fn: () => Promise<unknown>) {
    stopSpeaking();
    setPlaying(key);
    await fn();
    setPlaying((p) => (p === key ? null : p));
  }

  const btn = (key: string) =>
    `rounded-full px-2.5 py-1 text-xs font-semibold transition ${playing === key ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"}`;
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {MAIN_VOICES.map((v) => (
        <button key={v} className={btn(v)} onClick={(e) => (e.stopPropagation(), run(v, () => speak(word, { voice: v })))}>
          {VOICES[v].label}
        </button>
      ))}
      {human && (
        <button className={btn("human")} onClick={(e) => (e.stopPropagation(), run("human", () => playUrl(human)))} title="Bản ghi giọng người thật (Wiktionary)">
          🧑 Người thật
        </button>
      )}
      <button className={btn("slow")} onClick={(e) => (e.stopPropagation(), run("slow", () => speak(word, { rate: 0.65 })))}>
        🐢 Chậm
      </button>
    </div>
  );
}

/**
 * Shows a sentence with its intonation marks: stressed syllables in bold, the main stress of each
 * thought group highlighted, "|" pauses, "‿" linking and ↗/↘ tones. `marked` uses CAPS for stress
 * and *…* for the nucleus; letters are mapped back onto `en` so normal capitalisation is kept.
 */
export function IntonationText({ en, marked, className = "" }: { en: string; marked: string; className?: string }) {
  const orig = en.split(/\s+/);
  let wi = 0;
  const groups = marked.split(/\s*\|\s*/).filter(Boolean);
  return (
    <p className={`leading-[2.4] ${className}`}>
      {groups.map((g, gi) => {
        const tone = g.match(/(↘↗|↗↘|↘|↗)\s*$/)?.[1];
        const body = tone ? g.slice(0, g.lastIndexOf(tone)).trim() : g.trim();
        const pieces = body.split(/\s+/).flatMap((tok) => tok.split("‿").map((w, k, arr) => ({ w, link: k < arr.length - 1 })));
        return (
          <span key={gi}>
            {pieces.map((p, pi) => {
              const o = orig[wi++] ?? p.w.replace(/\*/g, "");
              const bare = p.w.replace(/\*/g, "");
              const nucStart = p.w.indexOf("*");
              const nucEnd = nucStart >= 0 ? p.w.indexOf("*", nucStart + 1) - 1 : -1;
              const stressed = new Array<boolean>(bare.length).fill(false);
              for (const m of bare.matchAll(/[A-Z]{2,}/g)) for (let k = m.index; k < m.index + m[0].length; k++) stressed[k] = true;
              const chars = bare.length === o.length ? o : bare;
              const spans: React.ReactNode[] = [];
              let k = 0;
              while (k < chars.length) {
                const nuc = nucStart >= 0 && k >= nucStart && k < nucEnd;
                const st = stressed[k] || nuc;
                let e = k + 1;
                while (e < chars.length && (stressed[e] || (nucStart >= 0 && e >= nucStart && e < nucEnd)) === st && (nucStart >= 0 && e >= nucStart && e < nucEnd) === nuc) e++;
                const text = chars.slice(k, e);
                spans.push(
                  nuc ? (
                    <span key={k} className="rounded bg-amber-200 px-0.5 font-extrabold text-slate-900">
                      {text}
                    </span>
                  ) : st ? (
                    <span key={k} className="font-bold text-indigo-700">
                      {text}
                    </span>
                  ) : (
                    <span key={k}>{text}</span>
                  ),
                );
                k = e;
              }
              return (
                <span key={pi}>
                  {spans}
                  {p.link ? <span className="mx-px text-indigo-400">‿</span> : pi < pieces.length - 1 ? " " : ""}
                </span>
              );
            })}
            {tone && <span className={`ml-1 font-bold ${tone === "↗" ? "text-orange-500" : tone === "↘" ? "text-sky-600" : "text-violet-600"}`}>{tone}</span>}
            {gi < groups.length - 1 && <span className="mx-2 text-slate-300">|</span>}
          </span>
        );
      })}
    </p>
  );
}

export function IntonationLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
      <span>
        <b className="text-indigo-700">Đậm</b> = âm nhấn
      </span>
      <span>
        <b className="rounded bg-amber-200 px-0.5 text-slate-900">Nền vàng</b> = nhấn mạnh nhất
      </span>
      <span>| = ngắt hơi</span>
      <span>‿ = nối âm</span>
      <span>
        <b className="text-sky-600">↘</b> xuống giọng
      </span>
      <span>
        <b className="text-orange-500">↗</b> lên giọng
      </span>
    </div>
  );
}

/** Renders the limited markdown used in content: paragraphs, "- " bullets and **bold**. */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const bold = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <strong key={i} className="text-slate-900">{p.slice(2, -2)}</strong> : p));
  return (
    <div className={`space-y-3 leading-relaxed ${className}`}>
      {text.split(/\n\s*\n/).map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        if (lines.length && lines.every((l) => l.trim().startsWith("- ")))
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{bold(l.trim().slice(2))}</li>
              ))}
            </ul>
          );
        return (
          <div key={i}>
            {lines.map((l, j) =>
              l.trim().startsWith("- ") ? (
                <div key={j} className="flex gap-2 pl-1">
                  <span>•</span>
                  <span>{bold(l.trim().slice(2))}</span>
                </div>
              ) : (
                <p key={j}>{bold(l)}</p>
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-slate-200 ${className}`}>
      <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const rec = useRef<MediaRecorder | null>(null);

  useEffect(() => () => rec.current?.stream.getTracks().forEach((t) => t.stop()), []);

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(new Blob(chunks, { type: mr.mimeType }));
        });
        setRecording(false);
      };
      rec.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setError("Không truy cập được micro. Hãy cho phép quyền micro trong trình duyệt.");
    }
  }

  function stop() {
    if (rec.current?.state === "recording") rec.current.stop();
  }

  return { recording, url, error, start, stop };
}

export function useTimer(running: boolean) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return [sec, setSec] as const;
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function DoneBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="card mt-4 flex flex-col items-center gap-3 bg-emerald-50 text-center ring-emerald-200">
      {children}
      <Link href="/" className="btn-primary">
        Về trang Hôm nay
      </Link>
    </div>
  );
}
