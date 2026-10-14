import { notFound } from "next/navigation";
import { fullTests } from "@/content";
import FullTestView from "./FullTestView";

export function generateStaticParams() {
  return fullTests.map((t) => ({ id: t.id }));
}

export default async function Page({ params }: PageProps<"/mock/full/[id]">) {
  const { id } = await params;
  const test = fullTests.find((t) => t.id === id);
  if (!test) notFound();
  return <FullTestView test={test} />;
}
