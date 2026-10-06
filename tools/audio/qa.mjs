// Checks generated audio: Whisper transcribes every file and we compare with the source text.
//   node qa.mjs [--workers 2] [--only words,shadowing] [--limit N]
// Writes qa-report.json (worst first) and prints a summary. Results are cached in qa-cache.json,
// so re-running only checks new or regenerated files.
import { fork } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allJobs } from "./jobs.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(HERE, "qa-cache.json");
// --recheck: single words Whisper-base failed on are re-tested with a bigger model, the clip
// repeated 3 times (Whisper hallucinates on very short isolated audio).
const RECHECK = process.argv.includes("--recheck") || process.env.QA_RECHECK === "1";
const MODEL = RECHECK ? "onnx-community/whisper-small.en" : "onnx-community/whisper-base.en";
const TILE = RECHECK ? 3 : 1;
const FIELD = RECHECK ? "heard2" : "heard";

// ---- comparison --------------------------------------------------------------

const NUM = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function numWords(n) {
  if (n < 20) return NUM[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + NUM[n % 10] : "");
  if (n < 1000) return NUM[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + numWords(n % 100) : "");
  return null;
}

export function words(s) {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/(\d),(\d)/g, "$1$2")
    .replace(/\d+/g, (d) => (Number(d) < 1000 ? numWords(Number(d)) : d))
    .replace(/%/g, " percent")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// Whisper writes US spelling; treat near-identical words (colour/color, realise/realize) as equal.
export const same = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && a[0] === b[0] && lev(a, b) <= 2) || a.replace(/'/g, "") === b.replace(/'/g, "");

/** Word error rate of hyp against ref, with fuzzy word equality. */
export function wer(ref, hyp) {
  const d = Array.from({ length: ref.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= hyp.length; j++) d[0][j] = j;
  for (let i = 1; i <= ref.length; i++)
    for (let j = 1; j <= hyp.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (same(ref[i - 1], hyp[j - 1]) ? 0 : 1));
  return ref.length ? d[ref.length][hyp.length] / ref.length : 0;
}

/** Single words: flag only if the word itself was never heard; sentences: word error rate > 25%. */
function isBad(j, c) {
  const ref = words(j.text);
  if (ref.length === 1) return ![c.heard, c.heard2].some((h) => h !== undefined && words(h).some((w) => same(w, ref[0])));
  return wer(ref, words(c.heard ?? "")) > 0.25;
}

// ---- worker --------------------------------------------------------------------

async function worker(list) {
  const { pipeline } = await import("@huggingface/transformers");
  const { MPEGDecoder } = await import("mpg123-decoder");
  const asr = await pipeline("automatic-speech-recognition", MODEL, { dtype: "fp32", device: "cpu" });
  const dec = new MPEGDecoder();
  await dec.ready;
  for (const j of list) {
    const { channelData, sampleRate } = dec.decode(new Uint8Array(fs.readFileSync(j.file)));
    await dec.reset();
    const src = channelData[0];
    // resample to 16 kHz for Whisper (linear interpolation is fine for speech)
    const ratio = sampleRate / 16000;
    const out = new Float32Array(Math.floor(src.length / ratio));
    for (let i = 0; i < out.length; i++) {
      const x = i * ratio;
      const k = Math.floor(x);
      out[i] = src[k] + (src[Math.min(k + 1, src.length - 1)] - src[k]) * (x - k);
    }
    // pad short clips (and repeat them when rechecking): Whisper is unreliable on very short audio
    const gap = TILE > 1 ? 9600 : 0;
    const padded = new Float32Array(Math.max(out.length * TILE + gap * (TILE - 1) + 8000, 16000));
    for (let t = 0; t < TILE; t++) padded.set(out, 4000 + t * (out.length + gap));
    const r = await asr(padded, { chunk_length_s: 30, stride_length_s: 5 });
    process.send({ key: j.file, mtime: fs.statSync(j.file).mtimeMs, field: FIELD, heard: r.text.trim() });
  }
}

// ---- main ----------------------------------------------------------------------

if (process.env.QA_WORKER) {
  process.on("message", async (list) => {
    await worker(list);
    process.exit(0);
  });
} else if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // run only when executed directly, not when imported for its helpers
  const arg = (n) => {
    const i = process.argv.indexOf("--" + n);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};
  const all = allJobs(arg("only")?.split(",")).filter((j) => fs.existsSync(j.file));
  const todo = (
    RECHECK
      ? all.filter((j) => cache[j.file] && !("heard2" in cache[j.file]) && words(j.text).length === 1 && isBad(j, cache[j.file]))
      : all.filter((j) => cache[j.file]?.mtime !== fs.statSync(j.file).mtimeMs)
  ).slice(0, Number(arg("limit") ?? Infinity));
  const n = Number(arg("workers") ?? 2);
  console.log(`${all.length} files exist, ${todo.length} to check`);
  if (todo.length) {
    const { pipeline } = await import("@huggingface/transformers");
    await pipeline("automatic-speech-recognition", MODEL, { dtype: "fp32", device: "cpu" }); // download once
    let done = 0;
    const start = Date.now();
    const self = fileURLToPath(import.meta.url);
    const save = () => fs.writeFileSync(CACHE, JSON.stringify(cache));
    await Promise.all(
      Array.from({ length: n }, (_, k) => todo.filter((_, i) => i % n === k)).map(
        (share) =>
          new Promise((resolve) => {
            const child = fork(self, [], { env: { ...process.env, QA_WORKER: "1", QA_RECHECK: RECHECK ? "1" : "" } });
            child.on("message", (m) => {
              // a fresh base check replaces the entry; a recheck adds heard2 to it
              cache[m.key] = m.field === "heard" ? { mtime: m.mtime, heard: m.heard } : { ...cache[m.key], [m.field]: m.heard };
              if (++done % 100 === 0) {
                save();
                const eta = Math.round((((Date.now() - start) / done) * (todo.length - done)) / 60000);
                console.log(`${done}/${todo.length} checked · ~${eta} min left`);
              }
            });
            child.on("exit", resolve);
            child.send(share);
          }),
      ),
    );
    save();
  }
  const report = all
    .filter((j) => cache[j.file])
    .map((j) => {
      const c = cache[j.file];
      const heard = c.heard2 ?? c.heard ?? "";
      const e = wer(words(j.text), words(heard));
      const bad = isBad(j, c);
      return { group: j.group, voice: j.voice, text: j.text, heard, wer: Math.round(e * 100) / 100, bad, file: path.relative(HERE, j.file) };
    })
    .filter((r) => r.bad)
    .sort((a, b) => b.wer - a.wer);
  fs.writeFileSync(path.join(HERE, "qa-report.json"), JSON.stringify(report, null, 1));
  const byGroup = {};
  for (const r of report) byGroup[`${r.group}/${r.voice}`] = (byGroup[`${r.group}/${r.voice}`] ?? 0) + 1;
  console.log(`flagged ${report.length}/${all.filter((j) => cache[j.file]).length} checked`, byGroup);
}
