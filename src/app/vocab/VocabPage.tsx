"use client";
import { useSearchParams } from "next/navigation";
import VocabTrainer from "./VocabTrainer";

export default function VocabPage() {
  const mode = useSearchParams().get("mode");
  const m = mode === "review" || mode === "learn" || mode === "quiz" ? mode : "home";
  return <VocabTrainer key={m} mode={m} />;
}
