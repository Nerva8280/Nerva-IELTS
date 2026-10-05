import { getSession } from "@/lib/session";
import { db, hasDb } from "@/lib/db";
import { pushConfigured, sendPush } from "@/lib/push";

interface Body {
  subscription?: { endpoint: string; keys: { p256dh: string; auth: string } };
  time?: string;
  tz?: string;
  days?: number[];
  test?: boolean;
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDb() || !pushConfigured()) return Response.json({ error: "Máy chủ chưa cấu hình thông báo" }, { status: 501 });
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.subscription?.endpoint || !/^\d\d:\d\d$/.test(b.time ?? "") || !b.tz) return Response.json({ error: "bad request" }, { status: 400 });
  const sql = await db();
  await sql`INSERT INTO push_subs (endpoint, user_id, sub, remind_time, tz, days)
    VALUES (${b.subscription.endpoint}, ${user.sub}, ${JSON.stringify(b.subscription)}::jsonb, ${b.time}, ${b.tz}, ${(b.days ?? []).join(",")})
    ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, sub = EXCLUDED.sub, remind_time = EXCLUDED.remind_time, tz = EXCLUDED.tz, days = EXCLUDED.days`;
  if (b.test) {
    try {
      await sendPush(b.subscription, { title: "IELTS Coach", body: "Thông báo đã bật! Bạn sẽ được nhắc vào giờ học.", url: "/" });
    } catch (e) {
      console.error("test push failed", e);
      return Response.json({ error: "Đã lưu nhưng gửi thử thất bại" }, { status: 502 });
    }
  }
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getSession();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDb()) return Response.json({ ok: true });
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  const sql = await db();
  if (endpoint) await sql`DELETE FROM push_subs WHERE endpoint = ${endpoint} AND user_id = ${user.sub}`;
  return Response.json({ ok: true });
}
