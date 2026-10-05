import VocabTrainer from "./VocabTrainer";

export default async function Page({ searchParams }: PageProps<"/vocab">) {
  const mode = (await searchParams).mode;
  const m = mode === "review" || mode === "learn" || mode === "quiz" ? mode : "home";
  return <VocabTrainer key={m} mode={m} />;
}
