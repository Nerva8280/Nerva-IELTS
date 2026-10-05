// Every audio file the app can request, in generation priority order.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAIN_VOICES, SENTENCE_VOICES, audioKey, normText, scriptVoices } from "../../src/lib/audio-key.ts";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA = path.join(ROOT, "src/content/data");
export const OUT = path.join(ROOT, "public/audio");
const load = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f + ".json"), "utf8"));
const HERE = path.dirname(fileURLToPath(import.meta.url));
// Spoken-form fixes for texts the model reads badly: { "voice|text": "text to synthesise" }.
const OVERRIDES = fs.existsSync(path.join(HERE, "overrides.json")) ? JSON.parse(fs.readFileSync(path.join(HERE, "overrides.json"), "utf8")) : {};

export function allJobs(only) {
  const list = [];
  const add = (group, voices, text) => {
    if (only && !only.includes(group)) return;
    for (const v of voices) list.push({ group, voice: v, text: normText(text) });
  };
  for (const set of load("shadowing")) for (const s of set.sentences) add("shadowing", MAIN_VOICES, s.en);
  if (fs.existsSync(path.join(DATA, "pronunciation.json")))
    for (const u of load("pronunciation"))
      for (const it of u.items) {
        if (it.kind === "pair") [it.a, it.b].forEach((w) => add("pronunciation", SENTENCE_VOICES, w));
        else add("pronunciation", SENTENCE_VOICES, it.kind === "say" ? it.text : (it.say ?? it.word));
      }
  const vocab = ["a1", "a2", "b1", "b2", "c1"].flatMap((l) => load("vocab-" + l));
  for (const w of vocab) add("words", MAIN_VOICES, w.word);
  for (const w of vocab) add("examples", SENTENCE_VOICES, w.example);
  for (const item of load("listening")) {
    const voices = scriptVoices(item.script);
    item.script.forEach((l, i) => add("listening", [voices[i]], l.text));
  }
  for (const t of load("speaking")) {
    t.questions.forEach((q) => add("speaking", SENTENCE_VOICES, q));
    add("speaking", SENTENCE_VOICES, t.sampleAnswer);
    t.usefulPhrases.forEach((p) => add("speaking", SENTENCE_VOICES, p.en));
  }
  for (const g of load("grammar")) g.examples.forEach((e) => add("grammar", SENTENCE_VOICES, e.en));
  for (const r of load("reading")) add("reading", ["uk-f"], r.passage);
  for (const w of load("writing")) add("writing", ["us-f"], w.modelAnswer);
  const seen = new Set();
  return list.filter((j) => {
    const file = path.join(OUT, j.voice, audioKey(j.text) + ".mp3");
    if (seen.has(file)) return false;
    seen.add(file);
    j.file = file;
    j.input = OVERRIDES[j.voice + "|" + j.text] ?? j.text;
    return true;
  });
}
