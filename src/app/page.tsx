import { getCatalog, vocab } from "@/content";
import { LEVELS } from "@/content/types";
import Dashboard from "./Dashboard";

export default function Page() {
  // number of core words per level (ids "b1-…"), for level progress; academic words and collocations don't count
  const levelWords = Object.fromEntries(LEVELS.map((l) => [l, vocab.filter((w) => w.id.startsWith(l.toLowerCase() + "-")).length]));
  return <Dashboard catalog={getCatalog()} levelWords={levelWords} />;
}
