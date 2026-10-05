import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export function hasDb() {
  return !!process.env.DATABASE_URL;
}

let ready: Promise<void> | null = null;

/** Neon HTTP client; tables are created on first use so no migration step is needed. */
export async function db(): Promise<NeonQueryFunction<false, false>> {
  const sql = neon(process.env.DATABASE_URL!);
  ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS progress (
      user_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      data JSONB NOT NULL,
      updated_at BIGINT NOT NULL
    )`;
    await sql`CREATE TABLE IF NOT EXISTS push_subs (
      endpoint TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      sub JSONB NOT NULL,
      remind_time TEXT NOT NULL,
      tz TEXT NOT NULL,
      days TEXT NOT NULL,
      last_sent TEXT
    )`;
  })().catch((e) => {
    ready = null;
    throw e;
  });
  await ready;
  return sql;
}
