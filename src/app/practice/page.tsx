import { getCatalog } from "@/content";
import PracticeHub from "./PracticeHub";

export default function Page() {
  return <PracticeHub catalog={getCatalog()} />;
}
