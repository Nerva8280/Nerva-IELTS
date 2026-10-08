// Applies the curated choices (which candidate sentence + reviewed Vietnamese translation) to
// src/content/data/native-examples.json.
//   node merge-picks.mjs --candidates <candidates.json> <picked-1.json> <picked-2.json> ...
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const ci = args.indexOf("--candidates");
const candidates = JSON.parse(fs.readFileSync(args[ci + 1], "utf8"));
const files = args.filter((_, k) => k !== ci && k !== ci + 1);
const picks = Object.assign({}, ...files.map((f) => JSON.parse(fs.readFileSync(f, "utf8"))));
const file = path.join(ROOT, "src/content/data/native-examples.json");
const out = JSON.parse(fs.readFileSync(file, "utf8"));
let applied = 0;
for (const [id, p] of Object.entries(picks)) {
  const o = candidates[id]?.options.find((x) => x.sid === p.sid);
  if (!o || !p.vi) continue;
  out[id] = { text: o.text, vi: p.vi, sid: o.sid, aid: o.aid, author: o.author, license: o.license };
  applied++;
}
fs.writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
console.log(`applied ${applied} curated picks; ${Object.keys(out).length} words have native examples`);
