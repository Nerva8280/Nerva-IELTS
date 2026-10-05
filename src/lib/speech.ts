"use client";
// Speech recognition (Chrome, Edge, Safari) for pronunciation feedback, plus word-level comparison.

/* eslint-disable @typescript-eslint/no-explicit-any */
function Recognition(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null;
}

export function recognitionSupported() {
  return !!Recognition();
}

export interface Listening {
  result: Promise<string>;
  stop: () => void;
}

export function listen(lang = "en-GB", continuous = false): Listening {
  const R = Recognition();
  if (!R) return { result: Promise.reject(new Error("unsupported")), stop: () => {} };
  const rec = new R();
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.continuous = continuous;
  const result = new Promise<string>((resolve, reject) => {
    let text = "";
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript + " ";
    };
    rec.onerror = (e: any) => (e.error === "no-speech" ? resolve("") : reject(new Error(e.error)));
    rec.onend = () => resolve(text.trim());
  });
  rec.start();
  return { result, stop: () => rec.stop() };
}

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Marks each word of the target as heard or missed (longest common subsequence). */
export function compareWords(target: string, said: string): { words: { w: string; ok: boolean }[]; score: number } {
  const display = target.split(/\s+/).filter(Boolean);
  const t = display.map((w) => tokenize(w).join(""));
  const s = tokenize(said);
  const dp = Array.from({ length: t.length + 1 }, () => new Array<number>(s.length + 1).fill(0));
  for (let i = t.length - 1; i >= 0; i--)
    for (let j = s.length - 1; j >= 0; j--)
      dp[i][j] = t[i] === s[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ok = new Array<boolean>(t.length).fill(false);
  let i = 0,
    j = 0;
  while (i < t.length && j < s.length) {
    if (t[i] === s[j]) {
      ok[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const counted = t.filter((w) => w).length || 1;
  const hits = ok.filter((x, k) => x && t[k]).length;
  return { words: display.map((w, k) => ({ w, ok: ok[k] || !t[k] })), score: Math.round((hits / counted) * 100) };
}
