import { getCatalog } from "@/content";
import ProgressView from "./ProgressView";

export default function Page() {
  return <ProgressView catalog={getCatalog()} />;
}
