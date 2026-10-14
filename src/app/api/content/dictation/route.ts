import { shadowing, vocab } from "@/content";
import type { Level } from "@/content/types";

export const dynamic = "force-static";

export interface DictationItem {
  aid: string;
  text: string;
  vi: string | null;
  level: Level;
  author: string;
  license: string;
}

/** Every native-speaker recording in the app, with a level, for dictation practice. */
export async function GET() {
  const items = new Map<string, DictationItem>();
  for (const set of shadowing)
    for (const s of set.sentences)
      if (s.aid && s.author && s.license) items.set(s.aid, { aid: s.aid, text: s.en, vi: s.vi, level: set.level, author: s.author, license: s.license });
  for (const w of vocab)
    if (w.native && !items.has(w.native.aid))
      items.set(w.native.aid, { aid: w.native.aid, text: w.native.text, vi: w.native.vi, level: w.level, author: w.native.author, license: w.native.license });
  return Response.json([...items.values()]);
}
