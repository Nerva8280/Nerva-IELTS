"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { startSync, stopSync, useAppState } from "@/lib/store";
import { loadVoices } from "@/lib/tts";
import { loadVocab } from "@/lib/vocab-client";
import LoginScreen from "./LoginScreen";

export interface Me {
  user: { sub: string; email: string; name: string; givenName?: string; picture?: string } | null;
  config: { googleClientId: string | null; sync: boolean; push: boolean };
}

const GUEST_KEY = "ielts-coach-guest";
const ME_KEY = "ielts-coach-me"; // last signed-in user, so the app opens offline

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}
const AuthCtx = createContext<{ me: Me | null; guest: boolean; logout: () => Promise<void> }>({
  me: null,
  guest: false,
  logout: async () => {},
});
export const useAuth = () => useContext(AuthCtx);

const NAV = [
  { href: "/", label: "Hôm nay", icon: "🏠" },
  { href: "/vocab", label: "Từ vựng", icon: "📖" },
  { href: "/practice", label: "Luyện tập", icon: "🎯" },
  { href: "/shadowing", label: "Shadowing", icon: "🎧" },
  { href: "/settings", label: "Cài đặt", icon: "⚙️" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [guest, setGuest] = useState(false);
  const [phase, setPhase] = useState<"loading" | "login" | "ready">("loading");
  const pathname = usePathname();
  const router = useRouter();
  const state = useAppState();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    void loadVoices();
    // fetch the vocabulary in the background so the Vocabulary page opens without waiting
    const warm = setTimeout(() => void loadVocab().catch(() => {}), 2500);
    (async () => {
      // Signed in on this device before: open at once with the local data; the session check and
      // the progress sync below run in the background (they can take a few seconds after the
      // server has been idle).
      const known = localStorage.getItem(ME_KEY);
      if (known) {
        setMe(JSON.parse(known) as Me);
        setPhase("ready");
      }
      let m: Me | null = null;
      try {
        m = (await (await fetch("/api/me")).json()) as Me;
        if (m.user) localStorage.setItem(ME_KEY, JSON.stringify(m));
        else localStorage.removeItem(ME_KEY);
      } catch {
        // offline: keep the last signed-in user; progress syncs when the connection is back
        const cached = localStorage.getItem(ME_KEY);
        if (cached) m = JSON.parse(cached) as Me;
      }
      setMe(m);
      const isGuest = localStorage.getItem(GUEST_KEY) === "1";
      setGuest(isGuest && !m?.user);
      if (m?.user) {
        await startSync(m.user.sub);
        setPhase("ready");
      } else if (isGuest || !m) setPhase("ready"); // offline: keep using local data
      else setPhase("login");
    })();
    return () => clearTimeout(warm);
  }, []);

  // First run: placement test, then pick a roadmap.
  useEffect(() => {
    if (phase !== "ready") return;
    if (!state.placement && pathname !== "/placement") router.replace("/placement");
    else if (state.placement && !state.roadmap && !["/placement", "/roadmap"].includes(pathname)) router.replace("/roadmap");
  }, [phase, state.placement, state.roadmap, pathname, router]);

  async function logout() {
    stopSync();
    localStorage.removeItem(GUEST_KEY);
    localStorage.removeItem(ME_KEY);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    location.reload();
  }

  if (phase === "loading")
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Đang tải…</div>;

  if (phase === "login")
    return (
      <LoginScreen
        clientId={me?.config.googleClientId ?? null}
        onLoggedIn={() => location.reload()}
        onGuest={() => {
          localStorage.setItem(GUEST_KEY, "1");
          location.reload();
        }}
      />
    );

  const hideNav = pathname === "/placement";
  return (
    <AuthCtx.Provider value={{ me, guest, logout }}>
      {!online && (
        <div className="sticky top-0 z-30 bg-slate-800 px-4 pt-[env(safe-area-inset-top)] text-center text-xs text-white">
          <div className="py-1.5">📴 Đang offline. Bài học đã tải vẫn dùng được; tiến độ tự đồng bộ khi có mạng.</div>
        </div>
      )}
      <div className="mx-auto min-h-screen max-w-2xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-28">{children}</div>
      {!hideNav && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto flex max-w-2xl">
            {NAV.map((n) => {
              const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? "text-indigo-600" : "text-slate-500"}`}
                >
                  <span className={`text-xl ${active ? "" : "grayscale opacity-70"}`}>{n.icon}</span>
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </AuthCtx.Provider>
  );
}
