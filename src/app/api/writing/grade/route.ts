import { getSession } from "@/lib/session";
import { graderReady } from "@/lib/grader";
import { gradeEssay } from "@/lib/writing-grader";
import { writing } from "@/content";
import { QuotaError, quotaMessage } from "@/lib/ai-quota";

export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Bạn cần đăng nhập để dùng AI chấm bài." }, { status: 401 });
  if (!graderReady()) return Response.json({ error: "Máy chủ chưa cấu hình AI chấm bài (GEMINI_API_KEY)." }, { status: 501 });
  const body = (await req.json().catch(() => null)) as { id?: string; essay?: string; level?: string; words?: string[] } | null;
  const item = writing.find((w) => w.id === body?.id);
  const essay = (body?.essay ?? "").trim();
  if (!item || !essay) return Response.json({ error: "Thiếu đề hoặc bài viết." }, { status: 400 });
  const count = essay.split(/\s+/).length;
  if (count < 30) return Response.json({ error: "Bài viết quá ngắn để chấm (cần ít nhất 30 từ)." }, { status: 400 });
  if (essay.length > 8000) return Response.json({ error: "Bài viết quá dài." }, { status: 413 });
  const data = item.data ? [item.data.caption, item.data.headers.join(" | "), ...item.data.rows.map((r) => r.join(" | "))].join("\n") : undefined;
  try {
    const grade = await gradeEssay({
      task: item.task,
      foundation: item.id.startsWith("w0"),
      prompt: item.prompt,
      data,
      essay,
      level: String(body?.level ?? "B1").slice(0, 3),
      learnedWords: (body?.words ?? []).filter((w) => typeof w === "string").slice(0, 200),
    });
    return Response.json(grade);
  } catch (e) {
    const status = (e as { status?: number }).status;
    console.error("essay grading failed", e);
    if (e instanceof QuotaError) return Response.json({ error: quotaMessage(e), quota: true }, { status: 429 });
    if (status === 429) return Response.json({ error: "AI chấm bài đang quá tải. Thử lại sau ít phút." }, { status: 429 });
    return Response.json({ error: "AI chưa chấm được bài này. Thử lại nhé." }, { status: 502 });
  }
}
