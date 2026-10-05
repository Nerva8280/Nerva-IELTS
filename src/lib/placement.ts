// Vocabulary-size placement test: "Do you know this word?" by frequency band, with fake words
// mixed in to correct for guessing.
import type { Level, PlacementWord } from "@/content/types";

// Number of word families each band represents (band 1 = most frequent 500 words, ...).
export const BAND_SIZES = [500, 1000, 1500, 2000, 3000, 4000];
export const REAL_PER_ROUND = 8;
export const FAKE_PER_ROUND = 2;

function shuffle<T>(a: T[]): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

export function buildRound(words: PlacementWord[], band: number, usedFakes: Set<string>): PlacementWord[] {
  const real = shuffle(words.filter((w) => !w.pseudo && w.band === band)).slice(0, REAL_PER_ROUND);
  const fakes = shuffle(words.filter((w) => w.pseudo && !usedFakes.has(w.word)))
    .sort((a, b) => Math.abs(a.band - band) - Math.abs(b.band - band))
    .slice(0, FAKE_PER_ROUND);
  fakes.forEach((f) => usedFakes.add(f.word));
  return shuffle([...real, ...fakes]);
}

export interface RoundResult {
  band: number;
  realYes: number;
  realTotal: number;
  fakeYes: number;
  fakeTotal: number;
}

/** Keep going while the learner knows at least half of a band's real words. */
export function shouldContinue(r: RoundResult): boolean {
  return r.band < 6 && r.realYes / Math.max(1, r.realTotal) >= 0.5;
}

export function score(rounds: RoundResult[]) {
  const fakeYes = rounds.reduce((a, r) => a + r.fakeYes, 0);
  const fakeTotal = rounds.reduce((a, r) => a + r.fakeTotal, 0);
  const fa = Math.min(0.8, fakeTotal ? fakeYes / fakeTotal : 0);
  const bands = BAND_SIZES.map((_, i) => {
    const r = rounds.find((x) => x.band === i + 1);
    if (!r) return 0;
    const hit = r.realYes / Math.max(1, r.realTotal);
    return Math.max(0, Math.min(1, (hit - fa) / (1 - fa)));
  });
  const vocabSize = Math.round(bands.reduce((a, b, i) => a + b * BAND_SIZES[i], 0) / 50) * 50;
  return { vocabSize, bands, falseAlarm: fa, level: levelFromSize(vocabSize) };
}

export function levelFromSize(n: number): Level {
  if (n < 800) return "A1";
  if (n < 1500) return "A2";
  if (n < 4000) return "B1";
  if (n < 6000) return "B2";
  return "C1";
}

export const LEVEL_INFO: Record<Level, { name: string; band: string; desc: string }> = {
  A1: { name: "Sơ cấp (Starter)", band: "< 3.0", desc: "Bắt đầu với từ vựng và câu thông dụng nhất." },
  A2: { name: "Sơ cấp (Elementary)", band: "3.0 – 3.5", desc: "Giao tiếp đơn giản, cần mở rộng vốn từ và ngữ pháp nền." },
  B1: { name: "Trung cấp (Intermediate)", band: "4.0 – 5.0", desc: "Đủ nền để học theo format IELTS." },
  B2: { name: "Trung cao cấp (Upper-Intermediate)", band: "5.5 – 6.0", desc: "Tập trung từ vựng học thuật và kỹ năng làm bài." },
  C1: { name: "Cao cấp (Advanced)", band: "6.5+", desc: "Luyện đề, nâng chất lượng Writing/Speaking." },
};
