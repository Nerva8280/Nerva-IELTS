import { notFound } from "next/navigation";
import { speaking } from "@/content";
import SpeakingView from "./SpeakingView";

export function generateStaticParams() {
  return speaking.map((s) => ({ id: s.id }));
}

export default async function Page({ params }: PageProps<"/speaking/[id]">) {
  const { id } = await params;
  const item = speaking.find((s) => s.id === id);
  if (!item) notFound();
  return <SpeakingView item={item} />;
}
