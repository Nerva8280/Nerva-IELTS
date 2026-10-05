// Called every 15–30 minutes by an external scheduler (cron-job.org / GitHub Actions) with
// "Authorization: Bearer <CRON_SECRET>". Sends each subscriber one reminder per day,
// within an hour after their chosen study time.
import { db, hasDb } from "@/lib/db";
import { localNow, pushConfigured, sendPush } from "@/lib/push";

const WINDOW_MIN = 60;

const MESSAGES = [
  "Đến giờ học rồi! 25 phút hôm nay đang chờ bạn 📚",
  "Giữ chuỗi ngày học nhé — vài từ mới và một bài shadowing thôi 🔥",
  "Mở app và nghe vài câu shadowing nào 🎧",
  "Một chút mỗi ngày = band điểm cao hơn. Bắt đầu thôi! 💪",
];

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (!secret || (auth !== `Bearer ${secret}` && key !== secret)) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDb() || !pushConfigured()) return Response.json({ sent: 0, reason: "not configured" });

  const sql = await db();
  const rows = await sql`SELECT endpoint, sub, remind_time, tz, days, last_sent FROM push_subs`;
  let sent = 0;
  for (const r of rows) {
    const now = localNow(r.tz as string);
    const [h, m] = String(r.remind_time).split(":").map(Number);
    const target = h * 60 + m;
    const days = String(r.days).split(",").filter(Boolean).map(Number);
    if (days.length && !days.includes(now.weekday)) continue;
    if (r.last_sent === now.date || now.minutes < target || now.minutes >= target + WINDOW_MIN) continue;
    try {
      await sendPush(r.sub as never, { title: "IELTS Coach", body: MESSAGES[sent % MESSAGES.length], url: "/" });
      await sql`UPDATE push_subs SET last_sent = ${now.date} WHERE endpoint = ${r.endpoint}`;
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await sql`DELETE FROM push_subs WHERE endpoint = ${r.endpoint}`;
      else console.error("push failed", e);
    }
  }
  return Response.json({ sent, checked: rows.length });
}
