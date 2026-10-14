import "server-only";
import type {
  GrammarLesson,
  FullTest,
  ListeningItem,
  MockListening,
  PlacementWord,
  PronUnit,
  TalkTopic,
  VoaListening,
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
import readingIeltsData from "./data/reading-ielts.json";
import listeningData from "./data/listening.json";
import writingData from "./data/writing.json";
import speakingData from "./data/speaking.json";
import shadowingData from "./data/shadowing.json";
import pronunciationData from "./data/pronunciation.json";
import talkData from "./data/talk.json";
import nativeExamples from "./data/native-examples.json";
import nativeShadowingData from "./data/native-shadowing.json";
import synonymsData from "./data/synonyms.json";
import voaData from "./data/voa-listening.json";
import mockListeningData from "./data/mock-listening.json";

export const placementWords = placement as PlacementWord[];
export const grammar = grammarData as GrammarLesson[];
// reading-ielts: full-length passages with the real IELTS question types (headings, matching, Y/N/NG, choose TWO…)
export const reading = [...readingData, ...readingIeltsData] as ReadingPassage[];
export const listening = listeningData as ListeningItem[];
export const writing = writingData as WritingPrompt[];
export const speaking = speakingData as SpeakingTopic[];
// native-speaker sets first, so they are offered before the AI-voice sets
export const shadowing = [...(nativeShadowingData as ShadowingSet[]), ...(shadowingData as ShadowingSet[])];
export const pronunciation = pronunciationData as PronUnit[];
export const talk = talkData as TalkTopic[];
export const voaListening = voaData as VoaListening[];
export const mockListening = mockListeningData as MockListening[];

/** Full tests: each listening test with one B1 + B2 + C1 IELTS-style passage; the spare passage sets are Reading-only tests. */
export const fullTests: FullTest[] = ["01", "02", "03", "04"].map((n, i) => ({
  id: String(i + 1),
  title: `Full Test ${i + 1}`,
  listening: mockListening[i] ?? null,
  reading: ["b1", "b2", "c1"].map((l) => reading.find((r) => r.id === `r2-${l}-${n}`)!),
}));

// Lower levels win when a word appears twice.
export const vocab: VocabWord[] = (() => {
  const seen = new Set<string>();
  const out: VocabWord[] = [];
  for (const list of [vocabA1, vocabA2, vocabB1, vocabB2, vocabC1] as VocabWord[][])
    for (const w of list) {
      const k = w.word.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      const native = (nativeExamples as Record<string, VocabWord["native"]>)[w.id];
      const synonyms = (synonymsData as Record<string, string[]>)[w.id];
      out.push({ ...w, ...(native ? { native } : {}), ...(synonyms?.length ? { synonyms } : {}) });
    }
  return out;
})();

export function getCatalog(): Catalog {
  return {
    grammar: grammar.map((g) => ({ id: g.id, level: g.level, title: g.title, kind: "grammar" })),
    reading: reading.map((r) => ({ id: r.id, level: r.level, title: r.title, kind: "reading", sub: r.id.startsWith("r2-") ? `Đề kiểu IELTS · ${r.questions.length} câu` : `${r.questions.length} câu` })),
    // real VOA recordings first so they are offered before the AI-voice dialogues
    listening: [
      ...voaListening.map((v) => ({ id: v.id, level: v.level, title: v.title, kind: "listening" as const, sub: "VOA · giọng thật" })),
      ...listening.map((l) => ({ id: l.id, level: l.level, title: l.title, kind: "listening" as const, sub: `Part ${l.part} · giọng AI` })),
    ],
    writing: writing.map((w) => ({ id: w.id, level: w.level, title: w.title, kind: "writing", sub: w.id.startsWith("w0") ? "Nền tảng" : `Task ${w.task}` })),
    speaking: speaking.map((s) => ({ id: s.id, level: s.level, title: s.topic, kind: "speaking", sub: `Part ${s.part}` })),
    shadowing: shadowing.map((s) => ({ id: s.id, level: s.level, title: s.title, kind: "shadowing", sub: s.native ? "Giọng người bản xứ" : "Giọng AI" })),
    pronunciation: pronunciation.map((p) => ({ id: p.id, level: p.level, title: p.title, kind: "pronunciation", sub: p.focus })),
  };
}
