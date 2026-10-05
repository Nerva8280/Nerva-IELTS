import { notFound } from "next/navigation";
import { shadowing } from "@/content";
import ShadowingSetView from "./ShadowingSetView";

export function generateStaticParams() {
  return shadowing.map((s) => ({ id: s.id }));
}

export default async function Page({ params }: PageProps<"/shadowing/[id]">) {
  const { id } = await params;
  const set = shadowing.find((s) => s.id === id);
  if (!set) notFound();
  return <ShadowingSetView set={set} />;
}
