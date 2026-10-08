import "server-only";
import type {
  GrammarLesson,
  ListeningItem,
  PlacementWord,
  PronUnit,
  TalkTopic,
  ReadingPassage,
  ShadowingSet,
  SpeakingTopic,
  VocabWord,
  WritingPrompt,
} from "./types";
import type { Catalog } from "@/lib/plan";
import placement from "./data/placement.json";
import vocabA1 from "./data/vocab-a1.json";
import vocabA2 from "./data/vocab-a2.json";
import vocabB1 from "./data/vocab-b1.json";
import vocabB2 from "./data/vocab-b2.json";
import vocabC1 from "./data/vocab-c1.json";
import grammarData from "./data/grammar.json";
import readingData from "./data/reading.json";
import listeningData from "./data/listening.json";
import writingData from "./data/writing.json";
import speakingData from "./data/speaking.json";
import shadowingData from "./data/shadowing.json";
import pronunciationData from "./data/pronunciation.json";
import talkData from "./data/talk.json";

export const placementWords = placement as PlacementWord[];
export const grammar = grammarData as GrammarLesson[];
export const reading = readingData as ReadingPassage[];
export const listening = listeningData as ListeningItem[];
export const writing = writingData as WritingPrompt[];
export const speaking = speakingData as SpeakingTopic[];
export const shadowing = shadowingData as ShadowingSet[];
export const pronunciation = pronunciationData as PronUnit[];
export const talk = talkData as TalkTopic[];

// Lower levels win when a word appears twice.
export const vocab: VocabWord[] = (() => {
  const seen = new Set<string>();
  const out: VocabWord[] = [];
  for (const list of [vocabA1, vocabA2, vocabB1, vocabB2, vocabC1] as VocabWord[][])
    for (const w of list) {
      const k = w.word.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(w);
    }
  return out;
})();

export function getCatalog(): Catalog {
  return {
    grammar: grammar.map((g) => ({ id: g.id, level: g.level, title: g.title, kind: "grammar" })),
    reading: reading.map((r) => ({ id: r.id, level: r.level, title: r.title, kind: "reading" })),
    listening: listening.map((l) => ({ id: l.id, level: l.level, title: l.title, kind: "listening", sub: `Part ${l.part}` })),
    writing: writing.map((w) => ({ id: w.id, level: w.level, title: w.title, kind: "writing", sub: w.id.startsWith("w0") ? "Nền tảng" : `Task ${w.task}` })),
    speaking: speaking.map((s) => ({ id: s.id, level: s.level, title: s.topic, kind: "speaking", sub: `Part ${s.part}` })),
    shadowing: shadowing.map((s) => ({ id: s.id, level: s.level, title: s.title, kind: "shadowing" })),
    pronunciation: pronunciation.map((p) => ({ id: p.id, level: p.level, title: p.title, kind: "pronunciation", sub: p.focus })),
  };
}
