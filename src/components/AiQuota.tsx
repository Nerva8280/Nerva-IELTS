"use client";
import { useEffect, useState } from "react";

const EVENT = "ai-graded";

/** Call after every grading request so the counters refresh. */
export const notifyGraded = () => window.dispatchEvent(new Event(EVENT));

const vnTime = (ms: number) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(ms);

/** "AI gradings left today" line shown next to the Speaking/Writing grading buttons. */
export default function AiQuota({ className = "" }: { className?: string }) {
  const [q, setQ] = useState<{ left: number; total: number; resetAt: number } | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/ai/quota")
        .then((r) => (r.ok ? r.json() : null))
        .then(setQ)
        .catch(() => {});
    load();
    window.addEventListener(EVENT, load);
    return () => window.removeEventListener(EVENT, load);
  }, []);

  if (!q?.total) return null;
  if (q.left === 0)
    return (
      <p className={`rounded-xl bg-amber-50 p-2 text-xs text-amber-800 ${className}`}>
        🤖 Hôm nay đã hết lượt AI chấm bài miễn phí. Lượt mới có lại lúc {vnTime(q.resetAt)}.
      </p>
    );
  return (
    <p className={`text-xs ${q.left <= 5 ? "text-amber-700" : "text-slate-400"} ${className}`}>
      🤖 Hôm nay còn khoảng {q.left}/{q.total} lượt AI chấm bài (làm mới lúc {vnTime(q.resetAt)}).
    </p>
  );
}
