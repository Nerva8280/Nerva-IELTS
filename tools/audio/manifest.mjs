// Lists every audio file (public/audio/manifest.json) so the app can download them for offline use.
// Runs before each build (package.json "build"), so it always matches the deployed files.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/audio");
const dirs = {};
for (const d of fs.readdirSync(OUT, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const files = fs.readdirSync(path.join(OUT, d.name)).filter((f) => f.endsWith(".mp3"));
  const bytes = files.reduce((a, f) => a + fs.statSync(path.join(OUT, d.name, f)).size, 0);
  dirs[d.name] = { bytes, files: files.map((f) => f.slice(0, -4)) };
}
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ dirs }));
console.log("audio manifest:", Object.entries(dirs).map(([k, v]) => `${k} ${v.files.length}`).join(", "));
