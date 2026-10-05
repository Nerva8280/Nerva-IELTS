// Draws IELTS Task 1 data as a line, bar or pie chart (SVG), so the prompt looks like the real test.
type Data = { caption: string; headers: string[]; rows: (string | number)[][] };

const COLORS = ["#4f46e5", "#f59e0b", "#10b981", "#ef4444", "#0ea5e9", "#a855f7"];

export function chartKind(title: string, data: Data): "line" | "bar" | "pie" | null {
  const numeric = data.rows.every((r) => r.slice(1).every((c) => typeof c === "number"));
  if (!numeric) return null;
  if (/line/i.test(title)) return "line";
  if (/bar/i.test(title)) return "bar";
  if (/pie/i.test(title)) return "pie";
  return null;
}

function Legend({ names }: { names: string[] }) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
      {names.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
          {n}
        </span>
      ))}
    </div>
  );
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v || 1)));
  return Math.ceil(v / p / (v / p > 5 ? 2 : 1)) * p * (v / p > 5 ? 2 : 1);
}

function LineChart({ data }: { data: Data }) {
  const W = 340,
    H = 220,
    L = 36,
    B = 24,
    T = 10,
    R = 18;
  const series = data.headers.slice(1);
  const max = niceMax(Math.max(...data.rows.flatMap((r) => r.slice(1) as number[])));
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, data.rows.length - 1);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e2e8f0" />
            <text x={L - 4} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#64748b">
              {t}
            </text>
          </g>
        ))}
        {data.rows.map((r, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#64748b">
            {r[0]}
          </text>
        ))}
        {series.map((_, si) => (
          <g key={si}>
            <polyline
              fill="none"
              stroke={COLORS[si % COLORS.length]}
              strokeWidth="2"
              points={data.rows.map((r, i) => `${x(i)},${y(r[si + 1] as number)}`).join(" ")}
            />
            {data.rows.map((r, i) => (
              <circle key={i} cx={x(i)} cy={y(r[si + 1] as number)} r="2.5" fill={COLORS[si % COLORS.length]} />
            ))}
          </g>
        ))}
      </svg>
      <Legend names={series} />
    </>
  );
}

function BarChart({ data }: { data: Data }) {
  const series = data.headers.slice(1);
  const max = niceMax(Math.max(...data.rows.flatMap((r) => r.slice(1) as number[])));
  return (
    <>
      <div className="space-y-2.5">
        {data.rows.map((r) => (
          <div key={String(r[0])}>
            <div className="mb-0.5 text-xs font-medium text-slate-600">{r[0]}</div>
            {series.map((_, si) => (
              <div key={si} className="flex items-center gap-2">
                <div className="h-3 rounded-r" style={{ width: `${((r[si + 1] as number) / max) * 85}%`, background: COLORS[si % COLORS.length] }} />
                <span className="text-[10px] text-slate-500">{r[si + 1]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <Legend names={series} />
    </>
  );
}

function PieChart({ data }: { data: Data }) {
  const labels = data.rows.map((r) => String(r[0]));
  return (
    <>
      <div className="flex flex-wrap justify-center gap-4">
        {data.headers.slice(1).map((h, ci) => {
          const vals = data.rows.map((r) => r[ci + 1] as number);
          const total = vals.reduce((a, b) => a + b, 0) || 1;
          let acc = 0;
          return (
            <div key={h} className="text-center">
              <svg viewBox="-1.1 -1.1 2.2 2.2" className="h-32 w-32 -rotate-90">
                {vals.map((v, i) => {
                  const a0 = (acc / total) * 2 * Math.PI;
                  acc += v;
                  const a1 = (acc / total) * 2 * Math.PI;
                  const large = a1 - a0 > Math.PI ? 1 : 0;
                  return (
                    <path
                      key={i}
                      d={`M0 0 L${Math.cos(a0)} ${Math.sin(a0)} A1 1 0 ${large} 1 ${Math.cos(a1)} ${Math.sin(a1)} Z`}
                      fill={COLORS[i % COLORS.length]}
                      stroke="white"
                      strokeWidth="0.02"
                    />
                  );
                })}
              </svg>
              <div className="mt-1 text-sm font-semibold">{h}</div>
            </div>
          );
        })}
      </div>
      <Legend names={labels} />
    </>
  );
}

export default function DataChart({ title, data }: { title: string; data: Data }) {
  const kind = chartKind(title, data);
  if (!kind) return null;
  return (
    <div className="mt-3 rounded-xl border border-slate-200 p-3">
      <div className="mb-2 text-center text-sm font-semibold">{data.caption}</div>
      {kind === "line" && <LineChart data={data} />}
      {kind === "bar" && <BarChart data={data} />}
      {kind === "pie" && <PieChart data={data} />}
    </div>
  );
}
