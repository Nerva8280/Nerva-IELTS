import { getSession } from "@/lib/session";
import { db, hasDb } from "@/lib/db";

export async function GET() {
  const user = await getSession();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDb()) return Response.json({ enabled: false, data: null, updatedAt: 0 });
  const sql = await db();
  const rows = await sql`SELECT data, updated_at FROM progress WHERE user_id = ${user.sub}`;
  const row = rows[0];
  return Response.json({ enabled: true, data: row?.data ?? null, updatedAt: Number(row?.updated_at ?? 0) });
}

export async function PUT(req: Request) {
  const user = await getSession();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDb()) return Response.json({ enabled: false });
  const body = (await req.json().catch(() => null)) as { data?: unknown; updatedAt?: number } | null;
  if (!body?.data || typeof body.updatedAt !== "number") return Response.json({ error: "bad request" }, { status: 400 });
  const sql = await db();
  // Only accept writes that are newer than what is stored (another device may have synced meanwhile).
  await sql`INSERT INTO progress (user_id, email, data, updated_at)
    VALUES (${user.sub}, ${user.email}, ${JSON.stringify(body.data)}::jsonb, ${body.updatedAt})
    ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, email = EXCLUDED.email
    WHERE progress.updated_at <= EXCLUDED.updated_at`;
  return Response.json({ ok: true });
}
