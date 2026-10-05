import { notFound } from "next/navigation";
import { writing } from "@/content";
import WritingView from "./WritingView";

export function generateStaticParams() {
  return writing.map((w) => ({ id: w.id }));
}

export default async function Page({ params }: PageProps<"/writing/[id]">) {
  const { id } = await params;
  const item = writing.find((w) => w.id === id);
  if (!item) notFound();
  return <WritingView item={item} />;
}
