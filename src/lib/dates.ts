// Local-calendar date helpers. Dates are stored as "YYYY-MM-DD" in the learner's timezone.

const pad = (n: number) => String(n).padStart(2, "0");

export function todayStr(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseDay(s);
  d.setDate(d.getDate() + n);
  return todayStr(d);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

export function weekday(s: string): number {
  return parseDay(s).getDay();
}

export const WEEKDAY_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function formatViDate(s: string): string {
  const d = parseDay(s);
  return `${WEEKDAY_VI[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}
