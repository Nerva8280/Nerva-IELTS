import "server-only";
import { db, hasDb } from "./db";

// Gemini free tier: each model allows a fixed number of requests per day (20 when checked in
// 2026-10), counted per Google project and reset at midnight Pacific time. Usage is recorded here so
// exhausted models are skipped straight away and the learner can see how many gradings are left.

export const DEFAULT_DAILY_LIMIT = 20;

const PT = "America/Los_Angeles";
export const quotaDay = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: PT }).format(now);

/** Next midnight Pacific time, in ms. */
export function nextReset(now = new Date()): number {
  const [h, m, s] = new Intl.DateTimeFormat("en-GB", { timeZone: PT, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    .format(now)
    .split(":")
    .map(Number);
  return now.getTime() + (24 * 3600 - (h * 3600 + m * 60 + s)) * 1000;
}

/** Thrown when every model is out of requests (daily) or rate-limited (per minute). */
export class QuotaError extends Error {
  status = 429;
  constructor(
    public daily: boolean,
    public resetAt: number,
  ) {
    super(daily ? "daily AI quota used up" : "AI rate limited");
  }
}

/** Reads "limit: 20 requests per day … retry in 20h54m29s" from a Gemini 429 error. */
export function parseLimit(e: unknown): { daily: boolean; limit?: number; retryMs?: number } {
  const err = e as { message?: string; error?: { error?: { message?: string } } };
  const msg = `${err.error?.error?.message ?? ""} ${err.message ?? ""}`;
  const lim = msg.match(/limit:\s*(\d+)\s*requests?\s*per\s*(day|minute)/i);
  const retry = msg.match(/retry in\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:([\d.]+)s)?/i);
  const retryMs = retry ? ((Number(retry[1] ?? 0) * 60 + Number(retry[2] ?? 0)) * 60 + Number(retry[3] ?? 0)) * 1000 : undefined;
  return { daily: !/per\s*minute/i.test(msg), limit: lim ? Number(lim[1]) : undefined, retryMs: retryMs || undefined };
}

// Without a database (local dev) usage is kept in memory.
const memory = new Map<string, { used: number; lim: number | null; blocked_until: number | null }>();

async function rows(day: string) {
  if (!hasDb()) return [...memory].filter(([k]) => k.startsWith(day + "|")).map(([k, v]) => ({ model: k.split("|")[1], ...v }));
  const sql = await db();
  return (await sql`SELECT model, used, lim, blocked_until FROM ai_quota WHERE day = ${day}`) as { model: string; used: number; lim: number | null; blocked_until: number | null }[];
}

/** Models that are not known to be out of requests right now, in the given order. */
export async function usableModels(models: string[]): Promise<string[]> {
  try {
    const now = Date.now();
    const blocked = new Set((await rows(quotaDay())).filter((r) => r.blocked_until && Number(r.blocked_until) > now).map((r) => r.model));
    return models.filter((m) => !blocked.has(m));
  } catch {
    return models; // never let bookkeeping stop grading
  }
}

export async function recordUse(model: string) {
  const day = quotaDay();
  try {
    if (!hasDb()) {
      const r = memory.get(`${day}|${model}`) ?? { used: 0, lim: null, blocked_until: null };
      memory.set(`${day}|${model}`, { ...r, used: r.used + 1 });
      return;
    }
    const sql = await db();
    await sql`INSERT INTO ai_quota (day, model, used) VALUES (${day}, ${model}, 1)
      ON CONFLICT (day, model) DO UPDATE SET used = ai_quota.used + 1`;
  } catch {
    /* ignore */
  }
}

/** Marks a model as limited after a 429; returns when it can be used again. */
export async function recordLimit(model: string, e: unknown): Promise<{ daily: boolean; until: number }> {
  const p = parseLimit(e);
  const until = Date.now() + (p.retryMs ?? (p.daily ? nextReset() - Date.now() : 60_000));
  const day = quotaDay();
  try {
    if (!hasDb()) {
      const r = memory.get(`${day}|${model}`) ?? { used: 0, lim: null, blocked_until: null };
      memory.set(`${day}|${model}`, { ...r, lim: p.limit ?? r.lim, blocked_until: until });
    } else {
      const sql = await db();
      await sql`INSERT INTO ai_quota (day, model, used, lim, blocked_until) VALUES (${day}, ${model}, 0, ${p.limit ?? null}, ${until})
        ON CONFLICT (day, model) DO UPDATE SET lim = COALESCE(${p.limit ?? null}, ai_quota.lim), blocked_until = ${until}`;
    }
  } catch {
    /* ignore */
  }
  return { daily: p.daily, until };
}

/** Gradings left today across all models (an estimate: other apps on the same key also count). */
export async function quotaStatus(models: string[]) {
  const now = Date.now();
  const byModel = new Map((await rows(quotaDay()).catch(() => [])).map((r) => [r.model, r]));
  const list = models.map((model) => {
    const r = byModel.get(model);
    const limit = r?.lim ?? DEFAULT_DAILY_LIMIT;
    const blockedDay = !!r?.blocked_until && Number(r.blocked_until) - now > 10 * 60_000;
    const left = blockedDay ? 0 : Math.max(0, limit - (r?.used ?? 0));
    return { model, used: r?.used ?? 0, limit, left };
  });
  return {
    left: list.reduce((a, m) => a + m.left, 0),
    total: list.reduce((a, m) => a + m.limit, 0),
    resetAt: nextReset(),
    models: list,
  };
}

const vnTime = (ms: number) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(ms);

/** What to tell the learner when grading is unavailable because of the free quota. */
export function quotaMessage(e: QuotaError): string {
  if (!e.daily) {
    const min = Math.max(1, Math.ceil((e.resetAt - Date.now()) / 60_000));
    return `AI chấm bài đang bận (giới hạn số lượt mỗi phút). Thử lại sau khoảng ${min} phút.`;
  }
  return `Hôm nay đã dùng hết lượt AI chấm bài miễn phí. Lượt mới có lại lúc ${vnTime(e.resetAt)} (giờ Việt Nam). Trong lúc chờ, bạn vẫn luyện nói và tự nghe lại bản ghi được.`;
}
