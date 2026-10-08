import { talk } from "@/content";
import TalkHome from "./TalkHome";

export default function Page() {
  return <TalkHome topics={talk} />;
}
