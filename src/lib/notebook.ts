"use client";
// Mistake notebook and the learner's own word list, both stored in AppState (synced like the rest).
import type { Question, VocabWord } from "@/content/types";
import { update } from "./store";
import { todayStr } from "./dates";
import { newCard } from "./srs";

export type MistakeKind = "grammar" | "vocab" | "pronunciation" | "exercise";

export interface Mistake {
  id: string;
  date: string;
  source: string; // where it came from, e.g. "Nói: Quê hương", "Viết: Task 2"
  kind: MistakeKind;
  original: string; // what the learner said/wrote (or the question for exercises)
  corrected: string;
  explanationVi: string;
  reviews: number;
  mastered: boolean;
  due?: string; // next review (missing = due now)
  step?: number; // successful spaced reviews so far (see MISTAKE_STEPS)
  question?: Question; // exercise that can be answered again on its own (grammar)
}

export interface MyWord {
  id: string; // "my-<slug>"
  word: string;
  note: string; // Vietnamese hint on meaning/usage
  date: string;
  source: string;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Adds mistakes, skipping ones already in the notebook (same wrong text and correction). */
export function addMistakes(items: Omit<Mistake, "id" | "date" | "reviews" | "mastered">[]) {
  if (!items.length) return;
  update((s) => {
    s.mistakes ??= [];
    const seen = new Set(s.mistakes.map((m) => norm(m.original) + "→" + norm(m.corrected)));
    for (const it of items) {
      const key = norm(it.original) + "→" + norm(it.corrected);
      if (!it.original.trim() || seen.has(key)) continue;
      seen.add(key);
      s.mistakes.push({ ...it, id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date: todayStr(), reviews: 0, mastered: false });
    }
    s.mistakes = s.mistakes.slice(-500);
  });
}

/**
 * Puts a word into spaced repetition. A word from the course vocabulary uses its own card;
 * any other word is kept in "Từ của tôi" with the learner's note as its meaning.
 */
export function addMyWord(word: string, note: string, source: string, vocab: VocabWord[] | null): "added" | "exists" {
  const w = word.trim();
  const known = vocab?.find((v) => norm(v.word) === norm(w));
  let result: "added" | "exists" = "added";
  update((s) => {
    const today = todayStr();
    if (known) {
      if (s.srs[known.id] && !s.srs[known.id].known) result = "exists";
      else s.srs[known.id] = newCard(today);
      return;
    }
    s.myWords ??= [];
    const id = "my-" + norm(w).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (s.myWords.some((m) => m.id === id)) {
      result = "exists";
      return;
    }
    s.myWords.push({ id, word: w, note, date: today, source });
    s.srs[id] = newCard(today);
  });
  return result;
}

/** "Từ của tôi" shaped like course vocabulary so flashcards and quizzes can use them. */
export function myWordsAsVocab(words: MyWord[] | undefined, level: VocabWord["level"]): VocabWord[] {
  return (words ?? []).map((m) => ({
    id: m.id,
    word: m.word,
    ipa: "",
    pos: "",
    vi: m.note,
    example: "",
    exampleVi: "",
    level,
    topic: "của tôi",
  }));
}
