import "server-only";
import { askGemini, clampBand, roundBand } from "./grader";

export interface WritingGrade {
  bands: { task: number; coherence: number; lexical: number; grammar: number; overall: number };
  feedback: { task: string; coherence: string; lexical: string; grammar: string };
  corrections: { original: string; corrected: string; explanationVi: string; kind: "grammar" | "vocab" }[];
  strengthsVi: string[];
  improvementsVi: string[];
  learnedWordsUsed: string[];
  suggestedWords: { word: string; howVi: string }[];
  improvedEssay: string;
}

const band = { type: "number", description: "IELTS band 0-9 in steps of 0.5" };
const vi = (d: string) => ({ type: "string", description: d + " Write in Vietnamese." });

const SCHEMA = {
  type: "object",
  properties: {
    bands: {
      type: "object",
      properties: { task: band, coherence: band, lexical: band, grammar: band, overall: band },
      required: ["task", "coherence", "lexical", "grammar", "overall"],
    },
    feedback: {
      type: "object",
      properties: {
        task: vi("Task Response (Task 2) or Task Achievement (Task 1): 2-3 concrete sentences."),
        coherence: vi("Coherence & Cohesion: paragraphing, progression, linking. 2-3 sentences."),
        lexical: vi("Lexical Resource: range, precision, collocation, spelling. 2-3 sentences."),
        grammar: vi("Grammatical Range & Accuracy: 2-3 sentences."),
      },
      required: ["task", "coherence", "lexical", "grammar"],
    },
    corrections: {
      type: "array",
      description: "Up to 10 most important errors, quoting the learner's exact words.",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          corrected: { type: "string" },
          explanationVi: vi("Short reason."),
          kind: { type: "string", enum: ["grammar", "vocab"] },
        },
        required: ["original", "corrected", "explanationVi", "kind"],
      },
    },
    strengthsVi: { type: "array", items: { type: "string" }, description: "2-3 strengths, in Vietnamese." },
    improvementsVi: { type: "array", items: { type: "string" }, description: "3 most useful things to do next time, in Vietnamese, concrete." },
    learnedWordsUsed: { type: "array", items: { type: "string" }, description: "Words from the learner's studied list that appear in the essay." },
    suggestedWords: {
      type: "array",
      description: "3-6 words/collocations that would improve this essay, preferably from the studied list.",
      items: { type: "object", properties: { word: { type: "string" }, howVi: vi("Where/how to use it, with a short English phrase.") }, required: ["word", "howVi"] },
    },
    improvedEssay: {
      type: "string",
      description: "The learner's essay rewritten about one band higher, keeping their ideas and structure; paragraphs separated by blank lines.",
    },
  },
  required: ["bands", "feedback", "corrections", "strengthsVi", "improvementsVi", "learnedWordsUsed", "suggestedWords", "improvedEssay"],
};

const INSTRUCTIONS = `You are a certified, experienced IELTS Writing examiner and a supportive teacher of Vietnamese adult learners.
Score the essay with the public IELTS Writing band descriptors, honestly and calibrated like a real examiner:
- Task 1 (Academic report): Task Achievement - accurate overview, key features, comparisons, data accuracy; no opinions.
- Task 2 (essay): Task Response - answers all parts of the question, clear position, developed and supported ideas.
- Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy as in the descriptors.
Under-length answers lose marks (Task 1 under 150 words, Task 2 under 250 words; foundation tasks under 120 words).
Memorised or off-topic text cannot score well on task. Overall = mean of the four bands (rounded by the app).
Write every explanation for the learner in Vietnamese, short and concrete; quote English in English.
When suggesting vocabulary, prefer words from the learner's studied list.`;

export async function gradeEssay(opts: {
  task: 1 | 2;
  foundation: boolean;
  prompt: string;
  data?: string;
  essay: string;
  level: string;
  learnedWords: string[];
}): Promise<WritingGrade> {
  const words = opts.essay.trim().split(/\s+/).filter(Boolean).length;
  const context = [
    `${opts.foundation ? "Foundation writing task (short opinion paragraph)" : `IELTS Academic Writing Task ${opts.task}`}.`,
    `Prompt: ${opts.prompt}`,
    opts.data ? `Chart/table data given to the candidate:\n${opts.data}` : "",
    `Learner's level: ${opts.level}. Essay length: ${words} words.`,
    `Learner's studied vocabulary: ${opts.learnedWords.slice(0, 200).join(", ") || "(none yet)"}`,
    `Essay:\n"""\n${opts.essay}\n"""`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const g = await askGemini<WritingGrade>(INSTRUCTIONS, [{ type: "text", text: context }], SCHEMA);
  const b = { task: clampBand(g.bands.task), coherence: clampBand(g.bands.coherence), lexical: clampBand(g.bands.lexical), grammar: clampBand(g.bands.grammar) };
  g.bands = { ...b, overall: roundBand((b.task + b.coherence + b.lexical + b.grammar) / 4) };
  return g;
}
