import { getCatalog, vocab } from "@/content";
import { LEVELS } from "@/content/types";
import Dashboard from "./Dashboard";

export default function Page() {
  // core word ids per level, used for level progress (the extra academic words and collocations don't count)
  const levelWords = Object.fromEntries(LEVELS.map((l) => [l, vocab.filter((w) => w.level === l && !/^(awl|col)-/.test(w.id)).map((w) => w.id)]));
  return <Dashboard catalog={getCatalog()} levelWords={levelWords} />;
}
