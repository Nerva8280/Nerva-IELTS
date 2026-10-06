"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LEVELS, type Level } from "@/content/types";
import { defaultState, replaceState, update, useAppState, getState, type AppState } from "@/lib/store";
import { englishVoices, loadVoices, speak, voiceGender } from "@/lib/tts";
import { getRoadmap } from "@/lib/plan";
import { LEVEL_INFO } from "@/lib/placement";
import { todayStr, WEEKDAY_VI } from "@/lib/dates";
import { MAIN_VOICES, VOICES } from "@/lib/audio-key";
import { useAuth } from "@/components/AppShell";
import { LevelChip, PageHeader } from "@/components/ui";

const ICS_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card mb-4">
      <div className="h2 mb-3">{title}</div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const s = useAppState();
  const { me, guest, logout } = useAuth();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [pushState, setPushState] = useState<"unknown" | "on" | "off" | "unsupported">("unknown");
  const [msg, setMsg] = useState("");
  const [installEvt, setInstallEvt] = useState<Event & { prompt?: () => void } | null>(null);
  const r = s.roadmap;

  useEffect(() => {
    loadVoices().then(() => setVoices(englishVoices()));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setPushState("unsupported");
      const reg = await navigator.serviceWorker.ready;
      setPushState((await reg.pushManager.getSubscription()) ? "on" : "off");
    })();
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  async function enablePush() {
    if (!r) return;
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setMsg("Bạn chưa cho phép thông báo.");
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) }));
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), time: r.reminder, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, days: r.studyDays, test: true }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Lỗi máy chủ");
      setPushState("on");
      setMsg(`Đã bật nhắc lúc ${r.reminder}. Bạn sẽ nhận một thông báo thử ngay.`);
    } catch (e) {
      setMsg(`Không bật được thông báo: ${(e as Error).message}`);
    }
  }

  async function disablePush() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setPushState("off");
  }

  function calendarUrl() {
    if (!r) return "#";
    const p = new URLSearchParams({ t: r.reminder, m: String(r.minutes), d: r.studyDays.join(","), s: todayStr().replace(/-/g, "") });
    return `/api/calendar?${p}`;
  }

  function googleCalendarUrl() {
    if (!r) return "#";
    const [h, m] = r.reminder.split(":").map(Number);
    const start = todayStr().replace(/-/g, "") + `T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
    const endMin = h * 60 + m + r.minutes;
    const end = todayStr().replace(/-/g, "") + `T${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}${String(endMin % 60).padStart(2, "0")}00`;
    const p = new URLSearchParams({
      action: "TEMPLATE",
      text: "📚 Học tiếng Anh (IELTS Coach)",
      dates: `${start}/${end}`,
      details: `Mở app: ${typeof location !== "undefined" ? location.origin : ""}`,
      recur: `RRULE:FREQ=WEEKLY;BYDAY=${r.studyDays.map((x) => ICS_DAYS[x]).join(",")}`,
    });
    return `https://calendar.google.com/calendar/render?${p}`;
  }

  function exportData() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(getState(), null, 1)], { type: "application/json" }));
    a.download = `ielts-coach-${todayStr()}.json`;
    a.click();
  }

  function importData(file: File) {
    file.text().then((t) => {
      try {
        const data = JSON.parse(t) as AppState;
        if (data.v !== 1 || !data.srs) throw new Error();
        replaceState({ ...data, owner: getState().owner, updatedAt: Date.now() });
        setMsg("Đã nhập dữ liệu.");
      } catch {
        setMsg("File không hợp lệ.");
      }
    });
  }

  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;

  return (
    <div>
      <PageHeader title="Cài đặt" />
      {msg && <div className="fixed inset-x-4 top-4 z-30 mx-auto max-w-md rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">{msg}</div>}

      <Section title="Tài khoản">
        {me?.user ? (
          <div className="flex items-center gap-3">
            {me.user.picture && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.user.picture} alt="" className="h-10 w-10 rounded-full" referrerPolicy="no-referrer" />
            )}
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{me.user.name}</div>
              <div className="truncate text-sm text-slate-500">{me.user.email}</div>
              <div className="text-xs text-slate-400">{me.config.sync ? "☁️ Tiến độ được đồng bộ giữa các thiết bị" : "Máy chủ chưa bật đồng bộ: dữ liệu lưu trên máy này"}</div>
            </div>
            <button className="btn-ghost" onClick={logout}>
              Đăng xuất
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">{guest ? "Chế độ dùng thử (lưu trên máy)" : "Ngoại tuyến"}</span>
            <button className="btn-ghost" onClick={logout}>
              Thoát
            </button>
          </div>
        )}
      </Section>

      <Section title="Trình độ & lộ trình">
        <div className="mb-3 flex items-center gap-2">
          <LevelChip level={s.level} />
          <span className="text-sm">
            {LEVEL_INFO[s.level].name} · IELTS ~{LEVEL_INFO[s.level].band}
          </span>
        </div>
        {s.placement && (
          <p className="muted mb-3">
            Kiểm tra ngày {s.placement.date}: ~{s.placement.vocabSize.toLocaleString("vi-VN")} từ
          </p>
        )}
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span>Đổi trình độ thủ công:</span>
          <select
            className="rounded-lg border border-slate-300 px-2 py-1"
            value={s.level}
            onChange={(e) =>
              update((st) => {
                st.level = e.target.value as Level;
                if (st.days[todayStr()]) delete st.days[todayStr()].plan;
              })
            }
          >
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
        {r && (
          <p className="mb-3 text-sm">
            Lộ trình <b>{r.id} – {getRoadmap(r.id).name}</b>, {r.minutes} phút/ngày, học {r.studyDays.map((d) => WEEKDAY_VI[d]).join(", ")} lúc {r.reminder}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Link href="/roadmap" className="btn-soft">
            Đổi lộ trình / giờ học
          </Link>
          <Link href="/placement" className="btn-ghost">
            Làm lại bài kiểm tra
          </Link>
        </div>
      </Section>

      <Section title="Nhắc giờ học">
        <p className="muted mb-3">Chọn một hoặc cả hai cách. Lịch điện thoại là cách nhắc ổn định nhất.</p>
        <div className="space-y-2">
          <a className="btn-soft w-full" href={calendarUrl()}>
            📅 Thêm vào lịch iPhone / iPad / Outlook
          </a>
          <a className="btn-soft w-full" href={googleCalendarUrl()} target="_blank" rel="noreferrer">
            📅 Thêm vào Google Calendar (Android)
          </a>
          {me?.config.push ? (
            pushState === "unsupported" ? (
              <p className="text-sm text-slate-500">
                Trình duyệt này chưa hỗ trợ thông báo đẩy.{isIOS && !standalone && " Trên iPhone, hãy cài app ra màn hình chính trước (xem bên dưới)."}
              </p>
            ) : pushState === "on" ? (
              <button className="btn-ghost w-full" onClick={disablePush}>
                🔕 Tắt thông báo đẩy
              </button>
            ) : (
              <button className="btn-primary w-full" onClick={enablePush}>
                🔔 Bật thông báo đẩy lúc {r?.reminder}
              </button>
            )
          ) : (
            <p className="text-xs text-slate-400">Thông báo đẩy sẽ khả dụng khi máy chủ được cấu hình (VAPID + cơ sở dữ liệu).</p>
          )}
        </div>
      </Section>

      <Section title="Cài app lên điện thoại">
        {standalone ? (
          <p className="text-sm text-emerald-700">✓ Bạn đang dùng app đã cài.</p>
        ) : installEvt ? (
          <button className="btn-primary w-full" onClick={() => installEvt.prompt?.()}>
            📲 Cài đặt app
          </button>
        ) : (
          <div className="space-y-1 text-sm text-slate-600">
            <p>
              <b>iPhone (Safari):</b> bấm nút Chia sẻ ⎋ → “Thêm vào MH chính”.
            </p>
            <p>
              <b>Android (Chrome):</b> bấm menu ⋮ → “Cài đặt ứng dụng” / “Thêm vào màn hình chính”.
            </p>
          </div>
        )}
      </Section>

      <Section title="Giọng đọc">
        <div className="mb-1 text-sm font-semibold">Giọng mặc định (giọng AI tự nhiên)</div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {MAIN_VOICES.map((v) => {
            const active = (s.settings.voice ?? (s.settings.accent === "en-US" ? "us-f" : "uk-f")) === v;
            return (
              <div key={v} className={`flex items-center gap-1 rounded-xl p-1 ${active ? "bg-indigo-600" : "bg-white ring-1 ring-slate-200"}`}>
                <button
                  className={`flex-1 py-1.5 text-sm font-semibold ${active ? "text-white" : "text-slate-700"}`}
                  onClick={() =>
                    update((st) => {
                      st.settings.voice = v;
                      st.settings.accent = v.startsWith("us") ? "en-US" : "en-GB";
                    })
                  }
                >
                  {VOICES[v].label}
                </button>
                <button className="rounded-lg bg-white/90 px-2 py-1" onClick={() => speak("Hello! How are you getting on with your English today?", { voice: v })} aria-label="Nghe thử">
                  🔊
                </button>
              </div>
            );
          })}
        </div>
        <p className="muted mb-3">Từ vựng và shadowing có đủ 4 giọng. Câu ví dụ, bài nói mẫu dùng giọng 🇬🇧 Nữ hoặc 🇺🇸 Nam theo giọng Anh/Mỹ bạn chọn.</p>
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-500">Giọng dự phòng của trình duyệt (khi chưa có file giọng AI)</summary>
          <div className="mt-2">
        {(["voiceF", "voiceM"] as const).map((k) => (
          <div key={k} className="mb-2 flex items-center gap-2 text-sm">
            <span className="w-16 shrink-0">{k === "voiceF" ? "Giọng nữ" : "Giọng nam"}</span>
            <select
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5"
              value={s.settings[k] ?? ""}
              onChange={(e) => update((st) => void (st.settings[k] = e.target.value || undefined))}
            >
              <option value="">Tự động</option>
              {voices
                .filter((v) => voiceGender(v) !== (k === "voiceF" ? "m" : "f"))
                .map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
            </select>
            <button className="btn-soft px-3 py-1.5" onClick={() => speak("Hello! How are you getting on with your English today?", { gender: k === "voiceF" ? "f" : "m", browserOnly: true })}>
              🔊
            </button>
          </div>
        ))}
          </div>
        </details>
        <div className="mt-3 flex items-center gap-3 text-sm">
          <span className="w-16 shrink-0">Tốc độ</span>
          <input
            type="range"
            min={0.6}
            max={1.2}
            step={0.05}
            value={s.settings.rate}
            onChange={(e) => update((st) => void (st.settings.rate = Number(e.target.value)))}
            className="flex-1"
          />
          <span className="w-10 text-right">{s.settings.rate.toFixed(2)}×</span>
        </div>
      </Section>

      <Section title="Dữ liệu">
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={exportData}>
            ⬇ Xuất dữ liệu
          </button>
          <label className="btn-ghost cursor-pointer">
            ⬆ Nhập dữ liệu
            <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          </label>
          <button
            className="btn bg-rose-50 text-rose-700"
            onClick={() => {
              if (confirm("Xóa toàn bộ tiến độ học? Không thể hoàn tác.")) replaceState({ ...defaultState(), owner: getState().owner, updatedAt: Date.now() });
            }}
          >
            Xóa tiến độ
          </button>
        </div>
      </Section>
    </div>
  );
}
