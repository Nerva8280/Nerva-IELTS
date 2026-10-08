import { getSession } from "@/lib/session";
import { gradeAnswer, graderReady } from "@/lib/grader";

export const maxDuration = 60;

const MAX_BYTES = 6 * 1024 * 1024; // ~3 minutes of compressed audio is far below this

// Browsers record webm (Chrome/Edge/Android) or mp4/AAC (Safari/iPhone); map to types Gemini accepts.
function geminiMime(type: string): string | null {
  const t = type.split(";")[0].trim().toLowerCase();
  if (t === "audio/webm" || t === "video/webm") return "audio/webm";
  if (t === "audio/mp4" || t === "video/mp4" || t === "audio/x-m4a" || t === "audio/m4a") return "audio/m4a";
  if (["audio/ogg", "audio/wav", "audio/mpeg", "audio/mp3", "audio/aac"].includes(t)) return t;
  return null;
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Bạn cần đăng nhập để dùng chấm bài nói." }, { status: 401 });
  if (!graderReady()) return Response.json({ error: "Máy chủ chưa cấu hình AI chấm bài (GEMINI_API_KEY)." }, { status: 501 });

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  const question = String(form?.get("question") ?? "").slice(0, 300);
  const part = Number(form?.get("part")) === 3 ? 3 : Number(form?.get("part")) === 2 ? 2 : 1;
  const level = String(form?.get("level") ?? "B1").slice(0, 3);
  const learnedWords = String(form?.get("words") ?? "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 200);
  if (!(audio instanceof Blob) || !question) return Response.json({ error: "Thiếu file ghi âm hoặc câu hỏi." }, { status: 400 });
  if (audio.size < 2000) return Response.json({ error: "Bản ghi quá ngắn. Hãy nói ít nhất vài câu." }, { status: 400 });
  if (audio.size > MAX_BYTES) return Response.json({ error: "Bản ghi quá dài." }, { status: 413 });
  const mime = geminiMime(audio.type);
  if (!mime) return Response.json({ error: `Định dạng ghi âm chưa hỗ trợ: ${audio.type}` }, { status: 415 });

  try {
    const audioBase64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
    const grade = await gradeAnswer({ audioBase64, mimeType: mime, question, part, level, learnedWords });
    return Response.json(grade);
  } catch (e) {
    const status = (e as { status?: number }).status;
    console.error("grading failed", e);
    if (status === 429) return Response.json({ error: "AI chấm bài đang quá tải hoặc hết lượt miễn phí hôm nay. Thử lại sau ít phút." }, { status: 429 });
    return Response.json({ error: "AI chưa chấm được bài này. Thử ghi âm lại nhé." }, { status: 502 });
  }
}
