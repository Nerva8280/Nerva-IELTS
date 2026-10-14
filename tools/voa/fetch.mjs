// Collects VOA Learning English stories (public domain) that have both an MP3 and a full transcript.
//   node fetch.mjs --out <candidates.json>
// Polite: one request at a time with a short pause.
import fs from "node:fs";

const FEEDS = {
  "As It Is": "zkm-ql-vomx-tpej-rqi",
  "Health & Lifestyle": "zmmpql-vomx-tpey-_q",
  "Science & Technology": "zmg_pl-vomx-tpeymtm",
  Education: "ztmp_l-vomx-tpek-__",
  "Arts & Culture": "zpyp_l-vomx-tpe_rym",
  "Education Tips": "z_gjqyl-vomx-tpevmrov",
  "American Stories": "zyg__l-vomx-tpetmty",
  "All About America": "zbmroml-vomx-tpeqboo_",
  "Words and Their Stories": "zmypyl-vomx-tpeyry_",
};
const BASE = "https://learningenglish.voanews.com";
const out = process.argv[process.argv.indexOf("--out") + 1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (s) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&#8217;|&rsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;|&quot;/g, '"')
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const results = [];
for (const [section, id] of Object.entries(FEEDS)) {
  const xml = await (await fetch(`${BASE}/api/${id}`)).text();
  const links = [...xml.matchAll(/<link>([^<]*\/a\/[^<]*)<\/link>/g)].map((m) => m[1].trim());
  for (const url of links) {
    await sleep(400);
    try {
      const html = await (await fetch(url)).text();
      const mp3 = html.match(/https:\/\/voa-audio\.voanews\.eu\/[^"&?]*?(?<!_hq)\.mp3/)?.[0];
      const title = decode(html.match(/<title>([^<]*)/)?.[1] ?? "");
      const date = html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] ?? "";
      const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => decode(m[1])).filter((p) => p.length > 25);
      const words = paragraphs.join(" ").split(/\s+/).length;
      if (mp3 && words >= 250) results.push({ section, url, title, date, mp3, words, paragraphs });
      process.stdout.write(mp3 && words >= 250 ? "+" : ".");
    } catch {
      process.stdout.write("x");
    }
  }
}
fs.writeFileSync(out, JSON.stringify(results, null, 1));
console.log(`\n${results.length} stories with audio and transcript`);
