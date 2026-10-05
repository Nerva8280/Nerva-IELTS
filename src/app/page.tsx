import { getCatalog, vocab } from "@/content";
import { LEVELS } from "@/content/types";
import Dashboard from "./Dashboard";

export default function Page() {
  // word ids per level, used for level progress
  const levelWords = Object.fromEntries(LEVELS.map((l) => [l, vocab.filter((w) => w.level === l).map((w) => w.id)]));
  return <Dashboard catalog={getCatalog()} levelWords={levelWords} />;
}
