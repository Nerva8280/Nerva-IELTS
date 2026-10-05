import { getCatalog } from "@/content";
import ShadowingHome from "./ShadowingHome";

export default function Page() {
  return <ShadowingHome catalog={getCatalog()} />;
}
