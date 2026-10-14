// Offline use: saves pages, build assets and audio in the Cache Storage that public/sw.js serves from.
// Cache names must match public/sw.js.
export const PAGES_CACHE = "ielts-pages";
export const STATIC_CACHE = "ielts-static";
export const AUDIO_CACHE = "ielts-audio";

export type Progress = (done: number, total: number) => void;

export const offlineSupported = () => typeof window !== "undefined" && "caches" in window && "serviceWorker" in navigator;

/** Runs `fn` over `items` with a few requests in flight; stops early when `signal` aborts. */
async function pool<T>(items: T[], fn: (x: T) => Promise<void>, onProgress?: Progress, signal?: AbortSignal, width = 6) {
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < items.length && !signal?.aborted) {
      const x = items[next++];
      try {
        await fn(x);
      } catch {
        /* skip a failed file; it is fetched again on the next download */
      }
      onProgress?.(++done, items.length);
    }
  };
  await Promise.all(Array.from({ length: width }, worker));
}

// Build assets referenced by a page: scripts and styles in the HTML, chunks named in the inline
// React payload, and fonts referenced from the CSS.
const ASSET_RE = /\/_next\/static\/[^"'\s\\)]+|static\/chunks\/[^"'\s\\)]+\.js/g;
const assetsIn = (text: string) => [...new Set(text.match(ASSET_RE) ?? [])].map((u) => (u.startsWith("/") ? u : `/_next/${u}`));

/** Saves every lesson page with its scripts, styles and fonts, plus the lesson data. */
export async function downloadLessons(onProgress?: Progress, signal?: AbortSignal) {
  const { pages, data } = (await (await fetch("/api/offline", { cache: "no-store" })).json()) as { pages: string[]; data: string[] };
  const pagesCache = await caches.open(PAGES_CACHE);
  const staticCache = await caches.open(STATIC_CACHE);
  const assets = new Set<string>();
  const total = pages.length + data.length;
  let done = 0;
  const tick = () => onProgress?.(++done, total + assets.size);

  await pool(
    [...pages, ...data],
    async (url) => {
      const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) return;
      if (pages.includes(url)) {
        const html = await res.clone().text();
        assetsIn(html).forEach((a) => assets.add(a));
      }
      await (pages.includes(url) ? pagesCache : staticCache).put(url, res);
      tick();
    },
    undefined,
    signal,
  );

  const css = [...assets].filter((a) => a.endsWith(".css"));
  for (const a of css) {
    const res = await fetch(a).catch(() => null);
    if (!res?.ok) continue;
    // fonts are referenced relative to the stylesheet: url(../media/x.woff2)
    for (const [, u] of (await res.text()).matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      const p = new URL(u, location.origin + a).pathname;
      if (p.startsWith("/_next/static/")) assets.add(p);
    }
  }
  const missing: string[] = [];
  for (const a of assets) if (!(await staticCache.match(a))) missing.push(a);
  done = total + assets.size - missing.length;
  await pool(
    missing,
    async (a) => {
      const res = await fetch(a);
      if (res.ok) await staticCache.put(a, res);
      tick();
    },
    undefined,
    signal,
  );
  if (signal?.aborted) return;

  // drop assets of older app versions
  for (const req of await staticCache.keys()) {
    const p = new URL(req.url).pathname;
    if (p.startsWith("/_next/static/") && !assets.has(p)) await staticCache.delete(req);
  }
  localStorage.setItem("ielts-offline-lessons", String(Date.now()));
}

interface AudioManifest {
  dirs: Record<string, { bytes: number; files: string[] }>;
}

export async function audioManifest(): Promise<AudioManifest> {
  return (await fetch("/audio/manifest.json", { cache: "no-store" })).json();
}

/** Downloads every audio file not cached yet. */
export async function downloadAudio(onProgress?: Progress, signal?: AbortSignal) {
  const m = await audioManifest();
  const cache = await caches.open(AUDIO_CACHE);
  const have = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
  const urls = Object.entries(m.dirs).flatMap(([dir, d]) => d.files.map((f) => `/audio/${dir}/${f}.mp3`));
  const todo = urls.filter((u) => !have.has(u));
  const already = urls.length - todo.length;
  await pool(
    todo,
    async (u) => {
      const res = await fetch(u);
      if (res.ok) await cache.put(u, res);
    },
    (done) => onProgress?.(already + done, urls.length),
    signal,
  );
  if (!signal?.aborted) localStorage.setItem("ielts-offline-audio", String(Date.now()));
}

export async function offlineStatus() {
  if (!offlineSupported()) return null;
  const [pages, audio, est] = await Promise.all([
    caches.open(PAGES_CACHE).then((c) => c.keys()),
    caches.open(AUDIO_CACHE).then((c) => c.keys()),
    navigator.storage?.estimate?.() ?? Promise.resolve(undefined),
  ]);
  return {
    pages: pages.length,
    audio: audio.length,
    usedMB: est?.usage ? Math.round(est.usage / 1e6) : null,
    lessonsAt: Number(localStorage.getItem("ielts-offline-lessons")) || null,
  };
}

export async function clearOffline() {
  await Promise.all([PAGES_CACHE, STATIC_CACHE, AUDIO_CACHE].map((c) => caches.delete(c)));
  localStorage.removeItem("ielts-offline-lessons");
  localStorage.removeItem("ielts-offline-audio");
}

// ---- audio playback from the cache ----

/** A saved audio file as a blob URL (iOS plays these reliably, unlike media served by a service worker). */
export async function offlineAudio(url: string): Promise<{ src: string; release: () => void } | null> {
  if (!url.startsWith("/audio/") || !offlineSupported()) return null;
  try {
    const hit = await (await caches.open(AUDIO_CACHE)).match(url);
    if (!hit) return null;
    const src = URL.createObjectURL(await hit.blob());
    return { src, release: () => URL.revokeObjectURL(src) };
  } catch {
    return null;
  }
}

/** Keeps a copy of an app audio file that was just played, so it also works offline. */
export function saveAudio(url: string) {
  if (!url.startsWith("/audio/") || !offlineSupported()) return;
  void caches
    .open(AUDIO_CACHE)
    .then(async (c) => {
      if (!(await c.match(url))) await c.add(url);
    })
    .catch(() => {});
}
