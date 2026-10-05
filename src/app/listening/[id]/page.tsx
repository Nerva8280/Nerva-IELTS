import { notFound } from "next/navigation";
import { listening } from "@/content";
import ListeningView from "./ListeningView";

export function generateStaticParams() {
  return listening.map((l) => ({ id: l.id }));
}

export default async function Page({ params }: PageProps<"/listening/[id]">) {
  const { id } = await params;
  const item = listening.find((l) => l.id === id);
  if (!item) notFound();
  return <ListeningView item={item} />;
}
