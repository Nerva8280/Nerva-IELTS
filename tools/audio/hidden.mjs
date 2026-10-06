// Builds public/audio/hidden.json: single-word files that Whisper (both passes) could not
// recognise, per voice, so the app hides those voice buttons. Homophones are not counted as
// errors (Whisper writing "hi" for "high" says nothing about the audio).
//   node hidden.mjs
import fs from "node:fs";
import path from "node:path";
import { allJobs, OUT } from "./jobs.mjs";
import { audioKey, WORD_VOICE } from "../../src/lib/audio-key.ts";
import { same, words } from "./qa.mjs";

const cache = JSON.parse(fs.readFileSync(new URL("./qa-cache.json", import.meta.url), "utf8"));

// Whisper spellings that sound the same as the target word.
const HOMOPHONES = {
  high: ["hi"], know: ["no"], son: ["sun"], buy: ["bye", "by"], write: ["right", "rite"], weak: ["week"],
  too: ["to", "two", "2"], tea: ["t", "tee"], see: ["sea", "c"], sea: ["see", "c"], eye: ["i", "aye"],
  queue: ["q", "cue"], hear: ["here"], wear: ["where", "ware"], meat: ["meet"], meet: ["meat"], marry: ["mary", "merry"],
  vary: ["very"], pear: ["pair", "pare"], peace: ["piece"], piece: ["peace"], weight: ["wait"], wait: ["weight"],
  sale: ["sail"], mail: ["male"], flour: ["flower"], hour: ["our"], whole: ["hole"], new: ["knew"], one: ["won"],
  two: ["to", "too", "2"], four: ["for", "4"], eight: ["ate", "8"], eat: ["eight", "8"], be: ["b", "bee"],
  you: ["u", "ewe"], why: ["y"], are: ["r"], tear: ["tier"], dear: ["deer"], bear: ["bare"], rain: ["reign"],
  road: ["rode"], plane: ["plain"], steal: ["steel"], week: ["weak"], break: ["brake"], fair: ["fare"],
  sun: ["son"], sell: ["cell"], sent: ["cent", "scent"], sight: ["site", "cite"], cereal: ["serial"],
  grey: ["gray"], "break down": ["breakdown"], outweigh: ["out way", "outway"], overtime: ["over time"],
  cooperate: ["co operate"], "set up": ["setup"], "work out": ["workout"], "drop out": ["dropout"],
};

function heardOk(text, heard) {
  if (heard === undefined) return false;
  const hw = words(heard);
  const tw = words(text);
  const h = hw.join(" ");
  const t = tw.join(" ");
  if (h.includes(t) || (tw.length === 1 && hw.some((w) => same(w, tw[0])))) return true;
  // British spelling vs Whisper US spelling (colour/color, organise/organize, programme/program)
  const us = t.replace(/our\b/g, "or").replace(/is(e|ed|ing|ation)\b/g, "iz$1").replace(/yse\b/g, "yze").replace(/mme\b/g, "m").replace(/tre\b/g, "ter").replace(/^sceptic/, "skeptic").replace(/practise/, "practice");
  if (h.includes(us)) return true;
  return (HOMOPHONES[text.toLowerCase()] ?? []).some((x) => ` ${h} `.includes(` ${x} `));
}

const hidden = {};
const review = [];
for (const j of allJobs(["words", "pronunciation"])) {
  if (words(j.text).length > 3 || !fs.existsSync(j.file)) continue;
  const c = cache[j.file];
  if (!c || heardOk(j.text, c.heard) || heardOk(j.text, c.heard2)) continue;
  if (j.voice === WORD_VOICE) review.push(`${j.text} → ${c.heard2 ?? c.heard}`);
  (hidden[j.voice] ??= []).push(audioKey(j.text));
}
for (const v of Object.keys(hidden)) hidden[v] = [...new Set(hidden[v])].sort();
fs.writeFileSync(path.join(OUT, "hidden.json"), JSON.stringify(hidden));
console.log("hidden per voice:", Object.fromEntries(Object.entries(hidden).map(([v, k]) => [v, k.length])));
console.log(`${WORD_VOICE} still unrecognised (${review.length}):`, review.join(" | "));
