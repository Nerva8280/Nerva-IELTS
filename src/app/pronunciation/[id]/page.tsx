import { notFound } from "next/navigation";
import { pronunciation } from "@/content";
import PronUnitView from "./PronUnitView";

export function generateStaticParams() {
  return pronunciation.map((p) => ({ id: p.id }));
}

export default async function Page({ params }: PageProps<"/pronunciation/[id]">) {
  const { id } = await params;
  const unit = pronunciation.find((p) => p.id === id);
  if (!unit) notFound();
  return <PronUnitView unit={unit} />;
}
