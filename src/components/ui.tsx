"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Level } from "@/content/types";
import { speak, stopSpeaking } from "@/lib/tts";

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

export function SpeakButton({ text, gender, rate, className = "", label }: { text: string; gender?: "f" | "m"; rate?: number; className?: string; label?: string }) {
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
        await speak(text, { gender, rate });
        setOn(false);
      }}
      aria-label="Nghe"
    >
      {on ? "⏹" : "🔊"}
      {label && <span>{label}</span>}
    </button>
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
