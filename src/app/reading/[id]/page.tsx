import { notFound } from "next/navigation";
import { reading } from "@/content";
import ReadingView from "./ReadingView";

export function generateStaticParams() {
  return reading.map((r) => ({ id: r.id }));
}

export default async function Page({ params }: PageProps<"/reading/[id]">) {
  const { id } = await params;
  const item = reading.find((r) => r.id === id);
  if (!item) notFound();
  return <ReadingView item={item} />;
}
