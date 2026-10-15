"use client";
// Draws IELTS Task 1 data like the exam paper: line graph, grouped bar chart, pie charts with
// percentages, or a process diagram. Tap a point/bar/slice to read its exact value.
import { useState } from "react";

type Data = { caption: string; headers: string[]; rows: (string | number)[][] };
export type ChartKind = "line" | "bar" | "pie" | "process";

// Categorical palette in fixed order (validated: CVD-safe for adjacent slots; three slots are
// under 3:1 on white, so every chart also has direct labels and the data table below it).
const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];
const INK = "#0b0b0b";
const INK2 = "#52514e";
const GRID = "#e1e0d9";
const SURFACE = "#ffffff";

export function chartKind(title: string, data: Data): ChartKind | null {
  if (/process/i.test(title)) return "process";
  const numeric = data.rows.every((r) => r.slice(1).every((c) => typeof c === "number"));
  if (!numeric) return null;
  if (/line/i.test(title)) return "line";
  if (/bar/i.test(title)) return "bar";
  if (/pie/i.test(title)) return "pie";
  return null;
}

// unit from the caption: "Annual visitors (thousands), 2014-2024" → "thousands"
const unitOf = (caption: string) => caption.match(/\(([^)]+)\)/)?.[1] ?? "";
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

function niceScale(max: number) {
  const raw = (max || 1) / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw)!;
  return { step, max: Math.ceil(max / step) * step };
}

function Legend({ names }: { names: string[] }) {
  if (names.length < 2) return null;
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs" style={{ color: INK2 }}>
      {names.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
          {n}
        </span>
      ))}
    </div>
  );
}

/** Value box for the tapped point, kept inside the chart. */
function Tooltip({ xPct, title, items, unit }: { xPct: number; title: string; items: { name: string; value: number; color: string }[]; unit: string }) {
  const shift = xPct < 25 ? "0%" : xPct > 75 ? "-100%" : "-50%";
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 rounded-lg bg-white px-2.5 py-1.5 text-xs shadow-lg ring-1 ring-slate-200"
      style={{ left: `${xPct}%`, transform: `translateX(${shift})`, color: INK }}
    >
      <div className="mb-0.5 font-semibold">{title}</div>
      {items.map((it) => (
        <div key={it.name} className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: it.color }} />
          <span style={{ color: INK2 }}>{it.name}:</span>
          <b>
            {fmt(it.value)}
            {unit === "%" ? "%" : ""}
          </b>
        </div>
      ))}
    </div>
  );
}

function YAxis({ max, step, y, L, R, W, unit }: { max: number; step: number; y: (v: number) => number; L: number; R: number; W: number; unit: string }) {
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
          <text x={L - 5} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill={INK2}>
            {fmt(t)}
          </text>
        </g>
      ))}
      {unit && (
        <text x={4} y={9} fontSize={10} fill={INK2}>
          {unit}
        </text>
      )}
    </g>
  );
}

function LineChart({ data, unit }: { data: Data; unit: string }) {
  const [active, setActive] = useState<number | null>(null);
  const series = data.headers.slice(1);
  const W = 340,
    H = 230,
    L = 34,
    R = series.length <= 4 ? 62 : 12,
    T = 18,
    B = 24;
  const { max, step } = niceScale(Math.max(...data.rows.flatMap((r) => r.slice(1) as number[])));
  const n = data.rows.length;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, n - 1);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  // direct labels at the line ends, nudged apart so they never overlap
  const ends = series
    .map((name, si) => ({ name, si, y: y(data.rows[n - 1][si + 1] as number) }))
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 12);
  const colW = (W - L - R) / Math.max(1, n - 1);
  return (
    <div className="relative" onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={data.caption}>
        <YAxis max={max} step={step} y={y} L={L} R={R} W={W} unit={unit} />
        {data.rows.map((r, i) => (
          <text key={i} x={x(i)} y={H - 7} textAnchor="middle" fontSize={10} fill={INK2}>
            {r[0]}
          </text>
        ))}
        {active !== null && <line x1={x(active)} x2={x(active)} y1={T} y2={H - B} stroke={INK2} strokeWidth={1} strokeDasharray="3 3" />}
        {series.map((_, si) => (
          <g key={si}>
            <polyline fill="none" stroke={COLORS[si % COLORS.length]} strokeWidth={2} strokeLinejoin="round" points={data.rows.map((r, i) => `${x(i)},${y(r[si + 1] as number)}`).join(" ")} />
            {data.rows.map((r, i) => (
              <circle key={i} cx={x(i)} cy={y(r[si + 1] as number)} r={4} fill={COLORS[si % COLORS.length]} stroke={SURFACE} strokeWidth={2} />
            ))}
          </g>
        ))}
        {series.length <= 4 &&
          ends.map((e) => (
            <text key={e.name} x={x(n - 1) + 8} y={e.y + 3.5} fontSize={10} fill={INK}>
              {e.name}
            </text>
          ))}
        {data.rows.map((_, i) => (
          <rect
            key={i}
            x={x(i) - colW / 2}
            y={T}
            width={colW}
            height={H - T - B}
            fill="transparent"
            onMouseEnter={() => setActive(i)}
            onClick={() => setActive(i)}
          />
        ))}
      </svg>
      {active !== null && (
        <Tooltip
          xPct={(x(active) / W) * 100}
          title={String(data.rows[active][0])}
          unit={unit}
          items={series.map((name, si) => ({ name, value: data.rows[active][si + 1] as number, color: COLORS[si % COLORS.length] }))}
        />
      )}
      <Legend names={series} />
    </div>
  );
}

/** Up to two lines of about `max` characters, for category names under bars. */
function wrap(s: string, max = 11): string[] {
  const words = s.split(" ");
  const lines = [""];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (cur && (cur + " " + w).length > max && lines.length < 2) lines.push(w);
    else lines[lines.length - 1] = cur ? cur + " " + w : w;
  }
  return lines;
}

function BarChart({ data, unit }: { data: Data; unit: string }) {
  const [active, setActive] = useState<number | null>(null);
  const series = data.headers.slice(1);
  const W = 340,
    H = 240,
    L = 34,
    R = 8,
    T = 18,
    B = 34;
  const { max, step } = niceScale(Math.max(...data.rows.flatMap((r) => r.slice(1) as number[])));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const groupW = (W - L - R) / data.rows.length;
  const gap = 2; // surface gap between adjacent bars
  const barW = Math.min(22, (groupW * 0.78 - gap * (series.length - 1)) / series.length);
  const gx = (i: number) => L + i * groupW + (groupW - (barW * series.length + gap * (series.length - 1))) / 2;
  const base = y(0);
  // bars rounded only at the data end, square on the baseline
  const bar = (x0: number, top: number) => {
    const r = Math.min(4, barW / 2, base - top);
    return `M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${base} Z`;
  };
  return (
    <div className="relative" onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={data.caption}>
        <YAxis max={max} step={step} y={y} L={L} R={R} W={W} unit={unit} />
        {data.rows.map((r, i) => (
          <g key={i} opacity={active === null || active === i ? 1 : 0.45}>
            {series.map((_, si) => {
              const v = r[si + 1] as number;
              return <path key={si} d={bar(gx(i) + si * (barW + gap), y(v))} fill={COLORS[si % COLORS.length]} />;
            })}
            {wrap(String(r[0])).map((line, k) => (
              <text key={k} x={L + i * groupW + groupW / 2} y={H - B + 13 + k * 11} textAnchor="middle" fontSize={9.5} fill={INK2}>
                {line}
              </text>
            ))}
            <rect x={L + i * groupW} y={T} width={groupW} height={H - T} fill="transparent" onMouseEnter={() => setActive(i)} onClick={() => setActive(i)} />
          </g>
        ))}
        <line x1={L} x2={W - R} y1={base} y2={base} stroke={INK2} strokeWidth={1} />
      </svg>
      {active !== null && (
        <Tooltip
          xPct={((L + active * groupW + groupW / 2) / W) * 100}
          title={String(data.rows[active][0])}
          unit={unit}
          items={series.map((name, si) => ({ name, value: data.rows[active][si + 1] as number, color: COLORS[si % COLORS.length] }))}
        />
      )}
      <Legend names={series} />
    </div>
  );
}

function PieChart({ data }: { data: Data }) {
  const [active, setActive] = useState<string | null>(null);
  const labels = data.rows.map((r) => String(r[0]));
  return (
    <div>
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
        {data.headers.slice(1).map((h, ci) => {
          const vals = data.rows.map((r) => r[ci + 1] as number);
          const total = vals.reduce((a, b) => a + b, 0) || 1;
          let acc = 0;
          return (
            <div key={h} className="text-center">
              <svg viewBox="-1.25 -1.25 2.5 2.5" className="h-40 w-40" role="img" aria-label={`${h}: ${labels.map((l, i) => `${l} ${vals[i]}%`).join(", ")}`}>
                {vals.map((v, i) => {
                  const a0 = (acc / total) * 2 * Math.PI - Math.PI / 2;
                  acc += v;
                  const a1 = (acc / total) * 2 * Math.PI - Math.PI / 2;
                  const mid = (a0 + a1) / 2;
                  const large = a1 - a0 > Math.PI ? 1 : 0;
                  const pct = (v / total) * 100;
                  const inside = pct >= 7;
                  const lr = inside ? 0.62 : 1.13;
                  const key = `${h}-${i}`;
                  return (
                    <g key={i} onClick={() => setActive(key)} onMouseEnter={() => setActive(key)}>
                      <path
                        d={`M0 0 L${Math.cos(a0)} ${Math.sin(a0)} A1 1 0 ${large} 1 ${Math.cos(a1)} ${Math.sin(a1)} Z`}
                        fill={COLORS[i % COLORS.length]}
                        stroke={SURFACE}
                        strokeWidth={0.03}
                        opacity={active && active.startsWith(h + "-") && active !== key ? 0.5 : 1}
                      />
                      <text
                        x={Math.cos(mid) * lr}
                        y={Math.sin(mid) * lr + 0.06}
                        textAnchor="middle"
                        fontSize={0.17}
                        fontWeight={600}
                        fill={INK}
                        stroke={inside ? SURFACE : "none"}
                        strokeWidth={0.05}
                        paintOrder="stroke"
                      >
                        {fmt(pct)}%
                      </text>
                    </g>
                  );
                })}
              </svg>
              <div className="text-sm font-semibold" style={{ color: INK }}>
                {h}
              </div>
              {active?.startsWith(h + "-") && (
                <div className="text-xs" style={{ color: INK2 }}>
                  {labels[Number(active.slice(h.length + 1))]}: <b style={{ color: INK }}>{vals[Number(active.slice(h.length + 1))]}%</b>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Legend names={labels} />
    </div>
  );
}

/** Process diagram: numbered stages joined by arrows. */
function ProcessChart({ data }: { data: Data }) {
  return (
    <ol className="space-y-1">
      {data.rows.map((r, i) => {
        const text = String(r[1]);
        const [stage, ...rest] = text.split(":");
        const tail = rest.join(":").trim();
        const desc = tail.charAt(0).toUpperCase() + tail.slice(1);
        return (
          <li key={i}>
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: COLORS[0] }}>
                {r[0]}
              </span>
              <div className="text-sm" style={{ color: INK2 }}>
                {desc ? (
                  <>
                    <b style={{ color: INK }}>{stage.trim()}</b>
                    <div>{desc}</div>
                  </>
                ) : (
                  text
                )}
              </div>
            </div>
            {i < data.rows.length - 1 && (
              <div className="py-0.5 text-center text-slate-400" aria-hidden>
                ↓
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function DataChart({ title, data }: { title: string; data: Data }) {
  const kind = chartKind(title, data);
  if (!kind) return null;
  const unit = unitOf(data.caption);
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 text-center text-sm font-semibold" style={{ color: INK }}>
        {data.caption}
      </div>
      {kind === "line" && <LineChart data={data} unit={unit} />}
      {kind === "bar" && <BarChart data={data} unit={unit} />}
      {kind === "pie" && <PieChart data={data} />}
      {kind === "process" && <ProcessChart data={data} />}
      {kind !== "process" && <p className="mt-2 text-center text-[11px] text-slate-400">Chạm vào biểu đồ để xem số liệu chính xác.</p>}
    </div>
  );
}
