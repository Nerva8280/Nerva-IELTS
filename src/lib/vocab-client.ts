"use client";
import { useEffect, useState } from "react";
import type { VocabWord } from "@/content/types";
import { useAppState } from "./store";
import { myWordsAsVocab } from "./notebook";

let cache: Promise<VocabWord[]> | null = null;

export function loadVocab(): Promise<VocabWord[]> {
  cache ??= fetch("/api/content/vocab")
    .then((r) => r.json() as Promise<VocabWord[]>)
    .catch((e) => {
      cache = null;
      throw e;
    });
  return cache;
}

export function useVocab(): VocabWord[] | null {
  const [v, setV] = useState<VocabWord[] | null>(null);
  useEffect(() => {
    loadVocab().then(setV, () => setV([]));
  }, []);
  return v;
}

/** Words the learner has studied (still-learning first, then "known", then their own words), for AI graders. */
export function useLearnedWords(): string[] {
  const vocab = useVocab();
  const s = useAppState();
  if (!vocab) return [];
  const byId = new Map(vocab.map((w) => [w.id, w.word]));
  const ids = Object.entries(s.srs).sort((a, b) => Number(!!a[1].known) - Number(!!b[1].known));
  const course = ids.map(([id]) => byId.get(id)).filter((w): w is string => !!w);
  return [...course, ...(s.myWords ?? []).map((m) => m.word)].slice(0, 200);
}

/** Course vocabulary plus the learner's own words (for flashcards and quizzes). */
export function useAllVocab(): VocabWord[] | null {
  const vocab = useVocab();
  const s = useAppState();
  if (!vocab) return null;
  return [...vocab, ...myWordsAsVocab(s.myWords, s.level)];
}
