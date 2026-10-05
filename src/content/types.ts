// Shared shapes for all learning content in src/content/data/*.json.

export type Level = "A1" | "A2" | "B1" | "B2" | "C1";
export const LEVELS: Level[] = ["A1", "A2", "B1", "B2", "C1"];

export interface VocabWord {
  id: string; // e.g. "a1-001"
  word: string;
  ipa: string; // British IPA, e.g. "/ˈwɔːtə/"
  pos: string; // n, v, adj, adv, prep, phr...
  vi: string; // Vietnamese meaning
  example: string; // natural English example sentence
  exampleVi: string;
  level: Level;
  topic: string; // e.g. "family", "education", "environment"
}

// Placement test: band 1 (most frequent) .. 6 (rare/academic). Pseudo words are fake.
export interface PlacementWord {
  word: string;
  band: 1 | 2 | 3 | 4 | 5 | 6;
  pseudo?: boolean;
  vi?: string;
}

export type Question =
  | { type: "mcq"; q: string; options: string[]; answer: number; explain?: string }
  | { type: "tfng"; q: string; answer: "TRUE" | "FALSE" | "NOT GIVEN"; explain?: string }
  // q contains "____" once; answer lists accepted variants (compared case-insensitively)
  | { type: "gap"; q: string; answer: string[]; explain?: string };

export interface GrammarLesson {
  id: string; // "g-a1-01"
  level: Level;
  title: string;
  summaryVi: string; // one sentence
  // Vietnamese explanation. Paragraphs separated by blank lines, bullet lines start with "- ",
  // **bold** allowed. No other markdown.
  explanationVi: string;
  examples: { en: string; vi: string }[];
  exercises: Question[]; // mcq and gap only, 6-8 items
}

export interface ShadowingSet {
  id: string; // "sh-a1-01"
  level: Level;
  title: string;
  topic: string;
  sentences: { en: string; vi: string; tip?: string }[]; // tip: Vietnamese intonation/linking note
}

export interface ReadingPassage {
  id: string; // "r-b1-01"
  level: Level;
  title: string;
  passage: string; // paragraphs separated by "\n\n"
  questions: Question[];
  vocab: { word: string; vi: string }[];
}

export interface ListeningItem {
  id: string; // "l-b1-01"
  level: Level;
  title: string;
  part: 1 | 2 | 3 | 4; // IELTS listening part style
  contextVi: string; // short Vietnamese description of the situation
  script: { speaker: string; gender: "f" | "m"; text: string }[];
  questions: Question[];
}

export interface WritingPrompt {
  id: string; // "w1-01" / "w2-01"
  level: Level;
  task: 1 | 2;
  title: string;
  prompt: string;
  data?: { caption: string; headers: string[]; rows: (string | number)[][] }; // Task 1 chart data as table
  tipsVi: string[];
  outline: string[]; // paragraph-by-paragraph plan (English)
  modelAnswer: string; // paragraphs separated by "\n\n"
  band: number; // approximate band of the model answer
  usefulPhrases: { en: string; vi: string }[];
}

export interface SpeakingTopic {
  id: string; // "s1-01"
  level: Level;
  part: 1 | 2 | 3;
  topic: string;
  questions: string[]; // Part 1/3 questions, or Part 2 cue card title as questions[0]
  cueCard?: string[]; // Part 2 bullet points ("You should say: ...")
  sampleAnswer: string;
  usefulPhrases: { en: string; vi: string }[];
}

// Pronunciation drills targeting typical Vietnamese-speaker problems.
export type PronItem =
  // minimal pair: learner hears one word and picks which, then says both
  | { kind: "pair"; a: string; b: string; aIpa: string; bIpa: string }
  // -s / -ed ending: which sound is the ending? options like ["/s/", "/z/", "/ɪz/"]
  | { kind: "ending"; word: string; ipa: string; options: string[]; answer: number }
  // word stress: which syllable is stressed?
  | { kind: "stress"; word: string; ipa: string; syllables: string[]; stress: number; say?: string } // say: spoken form when the bare word is ambiguous ("a record" / "to record")
  // say a word, phrase or sentence focusing on one feature
  | { kind: "say"; text: string; ipa?: string; focusVi: string };

export interface PronUnit {
  id: string; // "p-01"
  level: Level;
  title: string; // Vietnamese title, e.g. "Âm cuối /t/ và /d/"
  focus: string; // e.g. "/iː/ – /ɪ/"
  explanationVi: string; // same limited markdown as GrammarLesson.explanationVi
  mouthVi: string; // how to place mouth/tongue/lips to make the sound(s)
  commonErrorVi: string; // the typical Vietnamese learner error and why examiners notice it
  items: PronItem[];
}
