// Generates MP3 files for app content with the Kokoro-82M neural TTS model.
//   cd tools/audio && npm install && node gen.mjs [--workers 3] [--only words,shadowing]
// Files go to public/audio/<voice>/<hash>.mp3; existing files are skipped, so it can be
// stopped and resumed at any time. Anything not generated falls back to the browser voice.
import { fork } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VOICES } from "../../src/lib/audio-key.ts";
import { allJobs } from "./jobs.mjs";


const jobs = (only) => allJobs(only).filter((j) => !fs.existsSync(j.file));

// ---- audio helpers -------------------------------------------------------------

const RATE = 24000;

function splitSentences(text) {
  const parts = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text];
  // keep chunks reasonably short for the model, but don't split tiny fragments
  const out = [];
  for (const p of parts.map((x) => x.trim()).filter(Boolean)) {
    if (out.length && (out[out.length - 1].length < 25 || p.length < 8)) out[out.length - 1] += " " + p;
    else out.push(p);
  }
  return out;
}

function trim(samples, pad = 0.06) {
  const th = 0.008;
  let a = 0;
  let b = samples.length - 1;
  while (a < b && Math.abs(samples[a]) < th) a++;
  while (b > a && Math.abs(samples[b]) < th) b--;
  const p = Math.round(pad * RATE);
  return samples.subarray(Math.max(0, a - p), Math.min(samples.length, b + p));
}

async function encodeMp3(samples) {
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const enc = new Mp3Encoder(1, RATE, 40);
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)));
  const chunks = [];
  for (let i = 0; i < pcm.length; i += 1152) {
    const buf = enc.encodeBuffer(pcm.subarray(i, i + 1152));
    if (buf.length) chunks.push(Buffer.from(buf));
  }
  const end = enc.flush();
  if (end.length) chunks.push(Buffer.from(end));
  return Buffer.concat(chunks);
}

// ---- worker ----------------------------------------------------------------------

async function worker(list) {
  const { KokoroTTS } = await import("kokoro-js");
  const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "fp32", device: "cpu" });
  for (const j of list) {
    const parts = [];
    for (const s of splitSentences(j.input ?? j.text)) {
      const out = await tts.generate(s, { voice: VOICES[j.voice].kokoro });
      parts.push(trim(out.audio));
      parts.push(new Float32Array(Math.round(0.28 * RATE))); // pause between sentences
    }
    parts.pop();
    const total = parts.reduce((a, p) => a + p.length, 0);
    const all = new Float32Array(total);
    let o = 0;
    for (const p of parts) {
      all.set(p, o);
      o += p.length;
    }
    fs.mkdirSync(path.dirname(j.file), { recursive: true });
    const tmp = j.file + ".tmp";
    fs.writeFileSync(tmp, await encodeMp3(all));
    fs.renameSync(tmp, j.file);
    process.send?.({ done: 1, secs: total / RATE });
  }
}

// ---- main ------------------------------------------------------------------------

if (process.env.AUDIO_WORKER) {
  process.on("message", async (list) => {
    await worker(list);
    process.exit(0);
  });
} else {
  const arg = (name) => {
    const i = process.argv.indexOf("--" + name);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const n = Number(arg("workers") ?? 3);
  const only = arg("only")?.split(",");
  const list = jobs(only).slice(0, Number(arg("limit") ?? Infinity));
  console.log(`${list.length} files to generate with ${n} workers`);
  if (!list.length) process.exit(0);
  // Pre-download the model once before starting workers in parallel.
  const { KokoroTTS } = await import("kokoro-js");
  await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "fp32", device: "cpu" });
  let done = 0;
  let secs = 0;
  const start = Date.now();
  const self = fileURLToPath(import.meta.url);
  // Round-robin keeps each worker on the same priority order (shadowing first).
  const shares = Array.from({ length: n }, (_, k) => list.filter((_, i) => i % n === k));
  await Promise.all(
    shares.map(
      (share) =>
        new Promise((resolve) => {
          const child = fork(self, [], { env: { ...process.env, AUDIO_WORKER: "1" } });
          child.on("message", (m) => {
            done += m.done;
            secs += m.secs;
            if (done % 50 === 0 || done === list.length) {
              const el = (Date.now() - start) / 1000;
              const eta = Math.round(((list.length - done) * el) / done / 60);
              console.log(`${done}/${list.length} files · ${Math.round(secs / 60)} min audio · ~${eta} min left`);
            }
          });
          child.on("exit", resolve);
          child.send(share);
        }),
    ),
  );
  console.log("done");
}
