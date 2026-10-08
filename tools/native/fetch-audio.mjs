// Downloads the native-speaker recordings referenced by native-examples.json and
// native-shadowing.json from Tatoeba into public/audio/native/<audio id>.mp3 (unmodified, as the
// licences require). Skips files already present; polite: 2 parallel requests with a pause.
//   node fetch-audio.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "public/audio/native");
const load = (f) => {
  const p = path.join(ROOT, "src/content/data", f);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
};

const ids = new Set();
for (const e of Object.values(load("native-examples.json") ?? {})) ids.add(e.aid);
for (const set of load("native-shadowing.json") ?? []) for (const s of set.sentences) ids.add(s.aid);
fs.mkdirSync(OUT, { recursive: true });
const todo = [...ids].filter((id) => !fs.existsSync(path.join(OUT, `${id}.mp3`)));
console.log(`${ids.size} recordings, ${todo.length} to download`);

let done = 0;
let failed = 0;
async function worker() {
  while (todo.length) {
    const id = todo.shift();
    try {
      const res = await fetch(`https://tatoeba.org/audio/download/${id}`);
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("audio")) throw new Error(String(res.status));
      fs.writeFileSync(path.join(OUT, `${id}.mp3`), Buffer.from(await res.arrayBuffer()));
    } catch (e) {
      failed++;
      console.log("failed", id, e.message);
    }
    if (++done % 100 === 0) console.log(`${done} downloaded`);
    await new Promise((r) => setTimeout(r, 250));
  }
}
await Promise.all([worker(), worker()]);
console.log(`done, ${failed} failed`);
