import { listening, reading } from "@/content";
import MockTest, { MockPicker } from "./MockTest";

export default async function Page({ searchParams }: PageProps<"/mock">) {
  const { l, r } = await searchParams;
  const li = listening.find((x) => x.id === l);
  const ri = reading.find((x) => x.id === r);
  if (li && ri) return <MockTest key={`${li.id}-${ri.id}`} listening={li} reading={ri} />;
  return (
    <MockPicker
      listening={listening.map((x) => ({ id: x.id, level: x.level }))}
      reading={reading.map((x) => ({ id: x.id, level: x.level }))}
    />
  );
}
