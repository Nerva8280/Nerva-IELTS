import { speaking, talk } from "@/content";
import TalkHome, { type CueCard } from "./TalkHome";

// Part 3 discussion set that goes with each Part 2 card (s2-0N ↔ s3-0N; the last two borrow a close theme).
const PART3_FOR: Record<string, string> = { "s2-09": "s3-07", "s2-10": "s3-06" };

export default function Page() {
  const cards: CueCard[] = speaking
    .filter((s) => s.part === 2)
    .map((c) => {
      const p3 = speaking.find((s) => s.id === (PART3_FOR[c.id] ?? c.id.replace("s2-", "s3-")));
      return { id: c.id, title: c.questions[0], points: c.cueCard ?? [], part3: p3?.questions ?? [] };
    });
  return <TalkHome topics={talk} cards={cards} />;
}
