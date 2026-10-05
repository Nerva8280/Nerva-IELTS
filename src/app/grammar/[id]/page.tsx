import { notFound } from "next/navigation";
import { grammar } from "@/content";
import GrammarLessonView from "./GrammarLessonView";

export function generateStaticParams() {
  return grammar.map((g) => ({ id: g.id }));
}

export default async function Page({ params }: PageProps<"/grammar/[id]">) {
  const { id } = await params;
  const lesson = grammar.find((g) => g.id === id);
  if (!lesson) notFound();
  return <GrammarLessonView lesson={lesson} />;
}
