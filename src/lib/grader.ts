import "server-only";
import { GoogleGenAI } from "@google/genai";
import { nextReset, QuotaError, recordLimit, recordUse, usableModels } from "./ai-quota";

// Grades a recorded IELTS Speaking answer with Gemini, which listens to the audio itself
// (so pronunciation is judged from sound, not from a transcript).

// gemini-3.1-flash-lite: ~7 s per answer and consistent scores in tests (a band-7 sample got 7.5,
// a weak answer 5.0 twice); gemini-3.8-flash took ~2 min or returned 503. The rest are fallbacks:
// each model has its own free daily quota (20 requests), so more models mean more gradings a day.
// gemini-3.7-flash is the slowest (~16 s). Not usable on this key: 2.5 models (404), 3.5/3.6-flash (no quota).
export const GRADER_MODELS = (process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-flash-lite-latest,gemini-3.7-flash").split(",");

export interface TalkGrade {
  transcript: string;
  answeredQuestion: boolean;
  bands: { fluency: number; lexical: number; grammar: number; pronunciation: number; overall: number };
  feedback: { fluency: string; lexical: string; grammar: string; pronunciation: string };
  corrections: { original: string; corrected: string; explanationVi: string }[];
  pronunciationIssues: { word: string; issueVi: string }[];
  learnedWordsUsed: string[];
  suggestedWords: { word: string; howVi: string }[];
  improvedAnswer: string;
  followUp: string;
  encouragementVi: string;
}

const band = { type: "number", description: "IELTS band 0-9 in steps of 0.5" };
const viText = (d: string) => ({ type: "string", description: d + " Write in Vietnamese." });

const SCHEMA = {
  type: "object",
  properties: {
    transcript: { type: "string", description: "Verbatim transcript of what the learner said, including fillers (um, uh) and false starts." },
    answeredQuestion: { type: "boolean", description: "Did the learner actually answer the question asked?" },
    bands: {
      type: "object",
      properties: { fluency: band, lexical: band, grammar: band, pronunciation: band, overall: band },
      required: ["fluency", "lexical", "grammar", "pronunciation", "overall"],
    },
    feedback: {
      type: "object",
      properties: {
        fluency: viText("Fluency & Coherence: 1-3 sentences, concrete (pauses, linking, development of ideas)."),
        lexical: viText("Lexical Resource: 1-3 sentences, concrete (range, precision, collocations)."),
        grammar: viText("Grammatical Range & Accuracy: 1-3 sentences, concrete."),
        pronunciation: viText("Pronunciation: 1-3 sentences on intelligibility, word/sentence stress, intonation, final sounds, linking."),
      },
      required: ["fluency", "lexical", "grammar", "pronunciation"],
    },
    corrections: {
      type: "array",
      description: "Up to 6 most important language errors, quoted from the transcript.",
      items: {
        type: "object",
        properties: { original: { type: "string" }, corrected: { type: "string" }, explanationVi: viText("Short reason.") },
        required: ["original", "corrected", "explanationVi"],
      },
    },
    pronunciationIssues: {
      type: "array",
      description: "Up to 6 words that were mispronounced or unclear in the audio.",
      items: {
        type: "object",
        properties: { word: { type: "string" }, issueVi: viText("What was wrong and how to fix it (e.g. dropped final /t/, wrong stress).") },
        required: ["word", "issueVi"],
      },
    },
    learnedWordsUsed: { type: "array", items: { type: "string" }, description: "Words from the learner's studied-vocabulary list that they actually used." },
    suggestedWords: {
      type: "array",
      description: "3-5 words or collocations that would have improved this answer, preferably from the studied list.",
      items: {
        type: "object",
        properties: { word: { type: "string" }, howVi: viText("How to use it in this answer, with a short English example phrase.") },
        required: ["word", "howVi"],
      },
    },
    improvedAnswer: { type: "string", description: "A natural spoken answer about one band higher than the learner's, keeping their ideas, using some suggested words. Part 1: 3-4 sentences; Part 3: 5-7 sentences." },
    followUp: { type: "string", description: "One natural follow-up question an examiner would ask next, based on what the learner said." },
    encouragementVi: viText("One short encouraging sentence naming the best thing in the answer."),
  },
  required: [
    "transcript", "answeredQuestion", "bands", "feedback", "corrections", "pronunciationIssues",
    "learnedWordsUsed", "suggestedWords", "improvedAnswer", "followUp", "encouragementVi",
  ],
};

const INSTRUCTIONS = `You are a certified, experienced IELTS Speaking examiner and a supportive teacher of Vietnamese adult learners.
You receive one recorded answer to one Speaking question. Listen to the audio carefully.

Score each criterion with the public IELTS Speaking band descriptors, honestly and calibrated like a real examiner:
- Fluency & Coherence: speech rate, hesitation, self-correction, linking words, how ideas are developed.
- Lexical Resource: range, precision, collocations, paraphrase, topic vocabulary.
- Grammatical Range & Accuracy: variety of structures and their accuracy.
- Pronunciation: judge from the SOUND, not the transcript - intelligibility, individual sounds (final consonants, -s/-ed endings, vowel length, th/s/sh, l/n), word and sentence stress, intonation, chunking and linking, effect of Vietnamese accent.
Very short answers cannot show range: a one-sentence answer should rarely get above 5 for fluency or lexical resource.
If the audio is silent, not English, or unintelligible, set every band to 0, transcript to "", and explain in the feedback.
Overall = mean of the four bands (it will be rounded by the app).

Write every explanation for the learner in Vietnamese, short and concrete; quote English words and corrections in English.
When suggesting vocabulary, prefer words from the learner's studied list so they practise using what they learned.`;

let client: GoogleGenAI | null = null;
export function graderReady() {
  return !!process.env.GEMINI_API_KEY;
}

/** IELTS rounding of an average of half bands: .25 rounds up to .5 and .75 up to the next whole band. */
export function roundBand(mean: number) {
  return Math.floor(mean * 2 + 0.5 + 1e-9) / 2;
}
export const clampBand = (x: unknown) => Math.max(0, Math.min(9, Math.round((Number(x) || 0) * 2) / 2));

type GeminiInput = ({ type: "text"; text: string } | { type: "audio"; data: string; mime_type: string })[];

/** One structured-output call to Gemini, trying the next model when one is overloaded. */
export async function askGemini<T>(system: string, input: GeminiInput, schema: object): Promise<T> {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let text: string | undefined;
  let lastError: unknown;
  let limited: { daily: boolean; until: number } | null = null;
  const models = await usableModels(GRADER_MODELS);
  if (!models.length) throw new QuotaError(true, nextReset());
  for (const model of models) {
    try {
      const interaction = await client.interactions.create({
        model,
        system_instruction: system,
        input,
        response_format: { type: "text", mime_type: "application/json", schema: schema as Record<string, unknown> },
      });
      text = interaction.output_text;
      if (text) {
        await recordUse(model);
        break;
      }
    } catch (e) {
      lastError = e;
      const status = (e as { status?: number }).status ?? 0;
      if (status === 429) {
        const l = await recordLimit(model, e);
        // remember the earliest moment some model is usable again
        if (!limited || l.until < limited.until) limited = { daily: limited ? limited.daily && l.daily : l.daily, until: l.until };
      } else if (status < 500) throw e; // a bad request will not succeed on another model
    }
  }
  if (!text && limited) throw new QuotaError(limited.daily, limited.until);
  if (!text && lastError) throw lastError;
  if (!text) throw new Error("empty grader response");
  return JSON.parse(text) as T;
}

export async function gradeAnswer(opts: {
  audioBase64: string;
  mimeType: string;
  question: string;
  part: 1 | 2 | 3;
  level: string;
  learnedWords: string[];
}): Promise<TalkGrade> {
  const context = [
    `Question (IELTS Speaking Part ${opts.part}): ${opts.question}`,
    opts.part === 2 ? "This is a Part 2 long turn: the learner should speak for 1-2 minutes covering the cue card points." : "",
    `Learner's current level: ${opts.level}.`,
    `Learner's studied vocabulary (most recent first): ${opts.learnedWords.slice(0, 200).join(", ") || "(none yet)"}`,
  ]
    .filter(Boolean)
    .join("\n");
  const g = await askGemini<TalkGrade>(
    INSTRUCTIONS,
    [
      { type: "text", text: context },
      { type: "audio", data: opts.audioBase64, mime_type: opts.mimeType },
    ],
    SCHEMA,
  );
  const b = {
    fluency: clampBand(g.bands.fluency),
    lexical: clampBand(g.bands.lexical),
    grammar: clampBand(g.bands.grammar),
    pronunciation: clampBand(g.bands.pronunciation),
  };
  g.bands = { ...b, overall: roundBand((b.fluency + b.lexical + b.grammar + b.pronunciation) / 4) };
  return g;
}
