import { Suspense } from "react";
import VocabPage from "./VocabPage";

// The mode is read in the browser so this page stays static (and works offline).
export default function Page() {
  return (
    <Suspense>
      <VocabPage />
    </Suspense>
  );
}
