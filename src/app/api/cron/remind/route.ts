// Called every 15–30 minutes by an external scheduler (cron-job.org / GitHub Actions) with
// "Authorization: Bearer <CRON_SECRET>". Sends each subscriber one reminder per day,
// within an hour after their chosen study time; on Sunday the weekly report replaces it.
import { getCatalog } from "@/content";
import type { AppState } from "@/lib/store";
import { db, hasDb } from "@/lib/db";
import { localNow, pushConfigured, sendPush } from "@/lib/push";
import { reportMessage, weekReport } from "@/lib/report";

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
  const rows = await sql`SELECT endpoint, user_id, sub, remind_time, tz, days, last_sent, last_report FROM push_subs`;
  let sent = 0;
  for (const r of rows) {
    const now = localNow(r.tz as string);
    const [h, m] = String(r.remind_time).split(":").map(Number);
    const target = h * 60 + m;
    const days = String(r.days).split(",").filter(Boolean).map(Number);
    const inWindow = now.minutes >= target && now.minutes < target + WINDOW_MIN;
    // Sunday: the weekly report, at the usual time (also when Sunday is not a study day)
    const report = now.weekday === 0 && inWindow && r.last_report !== now.date;
    if (!report && days.length && !days.includes(now.weekday)) continue;
    if (!report && (r.last_sent === now.date || !inWindow)) continue;
    try {
      let payload = { title: "IELTS Coach", body: MESSAGES[sent % MESSAGES.length], url: "/" };
      if (report) {
        const [p] = await sql`SELECT data FROM progress WHERE user_id = ${r.user_id}`;
        if (!p) continue; // nothing synced yet
        payload = { title: "📊 Báo cáo tuần của bạn", body: reportMessage(weekReport(p.data as Partial<AppState>, getCatalog(), now.date)), url: "/progress" };
      }
      await sendPush(r.sub as never, payload);
      await sql`UPDATE push_subs SET last_sent = ${now.date}, last_report = ${report ? now.date : r.last_report} WHERE endpoint = ${r.endpoint}`;
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await sql`DELETE FROM push_subs WHERE endpoint = ${r.endpoint}`;
      else console.error("push failed", e);
    }
  }
  return Response.json({ sent, checked: rows.length });
}
