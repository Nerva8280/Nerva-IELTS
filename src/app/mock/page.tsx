import { fullTests, listening, reading } from "@/content";
import MockTest, { MockHub } from "./MockTest";

export default async function Page({ searchParams }: PageProps<"/mock">) {
  const { l, r } = await searchParams;
  const li = listening.find((x) => x.id === l);
  const ri = reading.find((x) => x.id === r);
  if (li && ri) return <MockTest key={`${li.id}-${ri.id}`} listening={li} reading={ri} />;
  return (
    <MockHub
      listening={listening.map((x) => ({ id: x.id, level: x.level }))}
      reading={reading.filter((x) => !x.id.startsWith("r2-")).map((x) => ({ id: x.id, level: x.level }))}
      tests={fullTests.map((t) => ({ id: t.id, title: t.title, listening: !!t.listening, reading: t.reading.map((p) => p.title) }))}
    />
  );
}
