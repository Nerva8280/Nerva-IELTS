// Builds candidate pools of native-recorded Tatoeba sentences per shadowing theme, for curation.
//   node shadow-pools.mjs --data <tatoeba dir> --out <pools.json>
import fs from "node:fs";
import path from "node:path";

const arg = (n) => process.argv[process.argv.indexOf("--" + n) + 1];
const DATA = arg("data");
const read = (f) => fs.readFileSync(path.join(DATA, f), "utf8").split("\n");
const OK_LICENSES = new Set(["CC BY-NC-ND 3.0", "CC BY 4.0", "CC BY-SA 4.0", "CC BY-NC 4.0"]);

const eng = new Map();
for (const l of read("eng_sentences.tsv")) {
  const [id, , text] = l.split("\t");
  if (text) eng.set(id, text.trim());
}
const audio = [];
for (const l of read("sentences_with_audio.csv")) {
  const [sid, aid, user, license] = l.split("\t");
  const text = eng.get(sid);
  if (!text || !OK_LICENSES.has(license)) continue;
  if (/\b(Tom|Mary|John|Sami|Layla|Ziri|Yanni|Skura)\b|[0-9"();:]/.test(text)) continue; // stock characters, numbers
  audio.push({ sid, aid, author: user, license, text });
}

// [id, level, title, min words, max words, keywords]
const THEMES = [
  ["intro", "A1", "Giới thiệu bản thân", 3, 9, ["my name", "nice to meet", "i'm from", "i live in", "i work", "i'm a student", "years old"]],
  ["routine", "A1", "Một ngày của tôi", 4, 10, ["get up", "usually", "every morning", "every day", "go to bed", "have breakfast", "after work"]],
  ["food", "A1", "Ăn uống", 3, 10, ["hungry", "breakfast", "lunch", "dinner", "coffee", "delicious", "eat out", "restaurant"]],
  ["shopping", "A1", "Mua sắm", 3, 10, ["how much", "buy", "cheap", "expensive", "shop", "pay", "price"]],
  ["directions", "A2", "Hỏi đường", 4, 11, ["where is", "station", "turn left", "turn right", "straight", "how do i get", "far from", "near here"]],
  ["weather", "A2", "Thời tiết", 4, 11, ["weather", "rain", "sunny", "cold today", "hot today", "snow", "windy"]],
  ["family", "A2", "Gia đình & bạn bè", 4, 11, ["my mother", "my father", "my brother", "my sister", "my parents", "my family", "best friend"]],
  ["hobbies", "A2", "Sở thích", 4, 12, ["i like", "i love", "free time", "hobby", "play the", "watch movies", "listen to music"]],
  ["feelings", "A2", "Cảm xúc", 4, 11, ["i'm happy", "i'm tired", "i'm worried", "i feel", "excited", "nervous", "upset"]],
  ["plans", "A2", "Kế hoạch & hẹn gặp", 4, 12, ["tomorrow", "this weekend", "are you free", "let's", "i'm going to", "next week"]],
  ["travel", "B1", "Du lịch", 6, 14, ["trip", "travel", "hotel", "passport", "flight", "abroad", "vacation", "holiday"]],
  ["work", "B1", "Công việc", 6, 14, ["my job", "colleague", "meeting", "boss", "office", "career", "salary"]],
  ["study", "B1", "Học tập", 6, 14, ["exam", "study", "university", "homework", "class", "teacher", "learn english"]],
  ["health", "B1", "Sức khỏe", 6, 14, ["doctor", "healthy", "exercise", "headache", "sleep", "medicine", "diet"]],
  ["technology", "B1", "Công nghệ", 6, 14, ["computer", "internet", "phone", "online", "email", "website", "technology"]],
  ["opinions", "B1", "Nêu ý kiến", 6, 14, ["i think", "in my opinion", "i believe", "i agree", "i don't think", "it seems"]],
  ["experiences", "B2", "Kể trải nghiệm", 9, 18, ["i've never", "when i was", "i remember", "the first time", "i used to", "last year"]],
  ["city", "B2", "Thành phố & nông thôn", 9, 18, ["city", "countryside", "traffic", "neighborhood", "crowded", "village"]],
  ["environment", "B2", "Môi trường", 9, 18, ["environment", "pollution", "climate", "recycle", "energy", "nature"]],
  ["society", "B2", "Xã hội", 9, 18, ["people", "society", "government", "young people", "generation", "community"]],
  ["persuade", "B2", "Thuyết phục & đề xuất", 9, 18, ["you should", "why don't you", "it would be better", "i suggest", "we need to"]],
  ["education", "C1", "Giáo dục", 12, 24, ["education", "students", "schools", "knowledge", "learning"]],
  ["science", "C1", "Khoa học", 12, 24, ["science", "scientists", "research", "discovered", "theory"]],
  ["economy", "C1", "Kinh tế", 12, 24, ["economy", "economic", "money", "price", "business", "market"]],
];

// deterministic shuffle so reruns give the same pools
function rand(seed) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

const pools = THEMES.map(([id, level, title, min, max, kws], ti) => {
  const r = rand(ti + 7);
  const matches = audio.filter((a) => {
    const n = a.text.split(/\s+/).length;
    const t = a.text.toLowerCase();
    return n >= min && n <= max && kws.some((k) => t.includes(k));
  });
  const pick = matches
    .map((a) => [r(), a])
    .sort((x, y) => x[0] - y[0])
    .slice(0, 60)
    .map(([, a]) => a);
  return { id, level, title, total: matches.length, options: pick };
});
fs.writeFileSync(arg("out"), JSON.stringify(pools, null, 1));
for (const p of pools) console.log(p.id.padEnd(12), p.level, String(p.total).padStart(6), "candidates");
