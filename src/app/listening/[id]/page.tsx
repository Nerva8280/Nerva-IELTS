import { notFound } from "next/navigation";
import { listening, voaListening } from "@/content";
import VoaListeningView from "./VoaListeningView";
import ListeningView from "./ListeningView";

export function generateStaticParams() {
  return [...listening, ...voaListening].map((l) => ({ id: l.id }));
}

export default async function Page({ params }: PageProps<"/listening/[id]">) {
  const { id } = await params;
  const voa = voaListening.find((v) => v.id === id);
  if (voa) return <VoaListeningView item={voa} />;
  const item = listening.find((l) => l.id === id);
  if (!item) notFound();
  return <ListeningView item={item} />;
}
