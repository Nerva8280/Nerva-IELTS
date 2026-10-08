// Picks, for every vocabulary word, an example sentence recorded by a native speaker on Tatoeba
// (https://tatoeba.org). Input: Tatoeba exports in --data (eng_sentences.tsv, sentences_with_audio.csv,
// vie_sentences.tsv, eng-vie_links.tsv). Output: src/content/data/native-examples.json.
//   node pick-examples.mjs --data <dir>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA = process.argv[process.argv.indexOf("--data") + 1];
const read = (f) => fs.readFileSync(path.join(DATA, f), "utf8").split("\n");

// Only licences that allow reuse (non-commercial, with attribution); audio is played unmodified.
const OK_LICENSES = new Set(["CC BY-NC-ND 3.0", "CC BY 4.0", "CC BY-SA 4.0", "CC BY-NC 4.0"]);

const eng = new Map();
for (const l of read("eng_sentences.tsv")) {
  const [id, , text] = l.split("\t");
  if (text) eng.set(id, text.trim());
}
const vie = new Map();
for (const l of read("vie_sentences.tsv")) {
  const [id, , text] = l.split("\t");
  if (text) vie.set(id, text.trim());
}
const viOf = new Map();
for (const l of read("eng-vie_links.tsv")) {
  const [e, v] = l.split("\t").map((x) => x?.trim());
  if (e && v && vie.has(v) && !viOf.has(e)) viOf.set(e, vie.get(v));
}
const audio = [];
for (const l of read("sentences_with_audio.csv")) {
  const [sid, aid, user, license] = l.split("\t");
  if (eng.has(sid) && OK_LICENSES.has(license)) audio.push({ sid, aid, user, license, text: eng.get(sid) });
}
console.log(`${audio.length} English sentences with reusable native audio, ${viOf.size} with Vietnamese`);

// index sentences by lower-cased word for fast lookup
const byWord = new Map();
for (const a of audio) {
  for (const w of new Set(a.text.toLowerCase().match(/[a-z']+/g) ?? [])) {
    if (!byWord.has(w)) byWord.set(w, []);
    byWord.get(w).push(a);
  }
}

function forms(word) {
  const w = word.toLowerCase();
  const f = new Set([w, w + "s", w + "es", w + "ed", w + "d", w + "ing", w + "er", w + "ly"]);
  if (w.endsWith("e")) f.add(w.slice(0, -1) + "ing");
  if (w.endsWith("y")) (f.add(w.slice(0, -1) + "ies"), f.add(w.slice(0, -1) + "ied"));
  if (/[^aeiou][aeiou][bdgmnpt]$/.test(w)) (f.add(w + w.at(-1) + "ed"), f.add(w + w.at(-1) + "ing"));
  return f;
}

function score(a, hasVi) {
  const n = a.text.split(/\s+/).length;
  let s = 0;
  if (hasVi) s += 4;
  if (n >= 5 && n <= 12) s += 3;
  else if (n <= 16) s += 1;
  else s -= 3;
  if (/\b(Tom|Mary|John|Sami|Layla)\b/.test(a.text)) s -= 1.5; // Tatoeba's stock characters
  if (/[;:"()]/.test(a.text)) s -= 1;
  if (!/[.?!]$/.test(a.text)) s -= 1;
  if (a.license !== "CC BY-NC-ND 3.0") s += 0.5; // slightly prefer other voices for variety
  return s;
}

const vocab = ["a1", "a2", "b1", "b2", "c1"].flatMap((l) => JSON.parse(fs.readFileSync(path.join(ROOT, "src/content/data", `vocab-${l}.json`), "utf8")));
const out = {};
const candidates = {}; // top options per word, for a human/AI pass that picks one and translates it
let found = 0;
for (const v of vocab) {
  const parts = v.word.toLowerCase().split(/\s+/);
  let cands;
  if (parts.length === 1) {
    cands = [...forms(parts[0])].flatMap((f) => byWord.get(f) ?? []);
  } else {
    // phrase: every word present and the phrase (first word inflected) appears in order
    const rest = parts.slice(1).join(" ");
    const re = new RegExp(`\\b(${[...forms(parts[0])].join("|")}) ${rest.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    cands = (byWord.get(parts.at(-1)) ?? []).filter((a) => re.test(a.text));
  }
  if (!cands.length) continue;
  const ranked = [...new Map(cands.map((a) => [a.sid, a])).values()].sort((x, y) => score(y, viOf.has(y.sid)) - score(x, viOf.has(x.sid)));
  const best = ranked[0];
  candidates[v.id] = { word: v.word, pos: v.pos, vi: v.vi, level: v.level, options: ranked.slice(0, 3).map((a) => ({ sid: a.sid, aid: a.aid, author: a.user, license: a.license, text: a.text })) };
  out[v.id] = { text: best.text, vi: viOf.get(best.sid) ?? null, sid: best.sid, aid: best.aid, author: best.user, license: best.license };
  found++;
}
if (process.argv.includes("--candidates")) fs.writeFileSync(process.argv[process.argv.indexOf("--candidates") + 1], JSON.stringify(candidates, null, 1));
fs.writeFileSync(path.join(ROOT, "src/content/data/native-examples.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`native examples for ${found}/${vocab.length} words; with Vietnamese: ${Object.values(out).filter((x) => x.vi).length}`);
