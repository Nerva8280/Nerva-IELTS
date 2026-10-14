// Service worker: reminders (web push) + offline use.
// Cache names are shared with src/lib/offline.ts (Settings → Học offline fills them in advance).
const PAGES = "ielts-pages";
const STATIC = "ielts-static";
const AUDIO = "ielts-audio";
const KEEP = [PAGES, STATIC, AUDIO];
const NAV_TIMEOUT = 6000; // on a very slow connection, show the saved page instead of waiting

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const put = (cache, req, res) => {
  if (res.status === 200) {
    const copy = res.clone();
    caches.open(cache).then((c) => c.put(req, copy));
  }
  return res;
};

const OFFLINE_PAGE = "<meta name=viewport content='width=device-width'><h1>Không có mạng</h1><p>Trang này chưa được tải để dùng offline (Cài đặt → Học offline).</p>";

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;

  // Build assets never change (hashed names): cache first.
  if (p.startsWith("/_next/static/")) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(STATIC, req, res))));
    return;
  }

  // Lesson data and small app files: fresh when online, saved copy when offline.
  if (p.startsWith("/api/content/") || p === "/audio/hidden.json" || p.startsWith("/icons/") || p === "/manifest.webmanifest") {
    event.respondWith(
      fetch(req)
        .then((res) => put(STATIC, req, res))
        .catch(() => caches.match(req, { ignoreVary: true }).then((hit) => hit || Response.error())),
    );
    return;
  }

  // Pages: network first; the saved copy when offline or when the network is too slow.
  if (req.mode === "navigate") {
    const saved = () =>
      caches
        .match(req, { ignoreVary: true })
        .then((hit) => hit || caches.match(p, { ignoreSearch: true, ignoreVary: true }))
        .then((hit) => hit || caches.match("/", { ignoreVary: true }));
    event.respondWith(
      new Promise((resolve) => {
        let settled = false;
        const finish = (res) => {
          if (!settled && res) {
            settled = true;
            resolve(res);
          }
        };
        const timer = setTimeout(() => saved().then(finish), NAV_TIMEOUT);
        fetch(req)
          .then((res) => {
            clearTimeout(timer);
            if (!url.search) put(PAGES, req, res);
            finish(res);
          })
          .catch(() => {
            clearTimeout(timer);
            saved().then((hit) => finish(hit || new Response(OFFLINE_PAGE, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } })));
          });
      }),
    );
  }
  // Audio is played from the cache by the page itself (src/lib/offline.ts), not here: iOS
  // needs range responses for media, which a plain cached copy cannot give.
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "IELTS Coach", body: "Đến giờ học rồi!" };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/192",
      badge: "/icons/192",
      vibrate: [100, 50, 100],
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.focus();
      return self.clients.openWindow(url);
    }),
  );
});
