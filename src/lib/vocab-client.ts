"use client";
import { useEffect, useState } from "react";
import type { VocabWord } from "@/content/types";

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
