"use client";
// Weekly band trend for one skill: hand-drawn SVG, one series (the card title names it, so no
// legend), shared 1-9 band scale across skills, gaps for weeks without data, tap/hover tooltip.
import { useState } from "react";
import type { Week } from "@/lib/progress";

const W = 320;
const H = 130;
const PAD = { l: 26, r: 30, t: 10, b: 20 };
const MIN = 1;
const MAX = 9;
const TICKS = [3, 5, 7, 9];
const SERIES = "#2a78d6"; // categorical slot 1
const GRID = "#e1e0d9";
const MUTED = "#898781";
const SURFACE = "#ffffff";

const x = (i: number, n: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, n - 1);
const y = (b: number) => PAD.t + ((MAX - b) / (MAX - MIN)) * (H - PAD.t - PAD.b);
const dm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

export default function SkillChart({ weeks, label }: { weeks: Week[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = weeks.length;
  // consecutive runs of weeks with data become line segments
  const runs: number[][] = [];
  weeks.forEach((w, i) => {
    if (w.band === null) return;
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1] === i - 1) last.push(i);
    else runs.push([i]);
  });
  const lastIdx = weeks.map((w) => w.band !== null).lastIndexOf(true);

  function pick(clientX: number, rect: DOMRect) {
    const px = ((clientX - rect.left) / rect.width) * W;
    let best: number | null = null;
    let bestD = Infinity;
    weeks.forEach((w, i) => {
      if (w.band === null) return;
      const d = Math.abs(x(i, n) - px);
      if (d < bestD) [best, bestD] = [i, d];
    });
    setHover(best);
  }

  const h = hover !== null ? weeks[hover] : null;
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y"
        role="img"
        aria-label={`Band ${label} theo tuần`}
        onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setHover(null)}
      >
        {TICKS.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill={MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>
              {t}
            </text>
          </g>
        ))}
        {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
          <text key={i} x={x(i, n)} y={H - 5} textAnchor="middle" fontSize={9} fill={MUTED}>
            {dm(weeks[i].start)}
          </text>
        ))}
        {hover !== null && <line x1={x(hover, n)} x2={x(hover, n)} y1={PAD.t} y2={H - PAD.b} stroke={MUTED} strokeWidth={1} />}
        {runs.map((r) =>
          r.length > 1 ? (
            <polyline
              key={r[0]}
              fill="none"
              stroke={SERIES}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={r.map((i) => `${x(i, n)},${y(weeks[i].band!)}`).join(" ")}
            />
          ) : null,
        )}
        {weeks.map((w, i) =>
          w.band === null ? null : <circle key={i} cx={x(i, n)} cy={y(w.band)} r={hover === i ? 5 : 4} fill={SERIES} stroke={SURFACE} strokeWidth={2} />,
        )}
        {lastIdx >= 0 && (
          <text x={x(lastIdx, n) + 8} y={y(weeks[lastIdx].band!) + 3} fontSize={10} fontWeight={600} fill="#0b0b0b">
            {weeks[lastIdx].band!.toFixed(1)}
          </text>
        )}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute -top-1 rounded-lg bg-slate-900 px-2 py-1 text-xs text-white shadow"
          // keep the tooltip inside the card near the edges
          style={{
            left: `${(x(hover, n) / W) * 100}%`,
            transform: `translate(${x(hover, n) / W > 0.75 ? "-100%" : x(hover, n) / W < 0.25 ? "0%" : "-50%"}, -100%)`,
            whiteSpace: "nowrap",
          }}
        >
          Tuần {dm(h.start)}: <b>{h.band!.toFixed(1)}</b> · {h.count} bài
        </div>
      )}
    </div>
  );
}
