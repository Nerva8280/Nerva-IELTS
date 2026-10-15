import { getSession } from "@/lib/session";
import { quotaStatus } from "@/lib/ai-quota";
import { GRADER_MODELS, graderReady } from "@/lib/grader";

export const dynamic = "force-dynamic";

/** AI gradings left today (shown next to the grading buttons). */
export async function GET() {
  if (!(await getSession())) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!graderReady()) return Response.json({ left: 0, total: 0, resetAt: 0, models: [] });
  return Response.json(await quotaStatus(GRADER_MODELS));
}
