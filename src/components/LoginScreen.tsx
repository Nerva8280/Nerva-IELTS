"use client";
import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
  }
}

export default function LoginScreen({ clientId, onLoggedIn, onGuest }: { clientId: string | null; onLoggedIn: () => void; onGuest: () => void }) {
  const btn = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!clientId) return;
    const init = () => {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp: { credential: string }) => {
          setError("");
          const r = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ credential: resp.credential }),
          });
          if (r.ok) onLoggedIn();
          else setError(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Đăng nhập thất bại");
        },
      });
      if (btn.current) window.google.accounts.id.renderButton(btn.current, { theme: "filled_blue", size: "large", shape: "pill", text: "signin_with", locale: "vi" });
    };
    if (window.google?.accounts) return init();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = init;
    s.onerror = () => setError("Không tải được nút đăng nhập Google (kiểm tra kết nối mạng)");
    document.head.appendChild(s);
  }, [clientId, onLoggedIn]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-600 to-indigo-800 px-6 text-white">
      <div className="text-6xl">🎧</div>
      <h1 className="mt-4 text-3xl font-bold">IELTS Coach</h1>
      <p className="mt-2 max-w-sm text-center text-indigo-100">
        Tự học tiếng Anh 20–30 phút mỗi ngày: kiểm tra trình độ, lộ trình riêng, giọng đọc chuẩn và shadowing.
      </p>
      <div className="mt-10 flex min-h-12 flex-col items-center gap-3 rounded-2xl bg-white p-5 text-slate-800">
        {clientId ? (
          <div ref={btn} />
        ) : (
          <>
            <p className="max-w-xs text-center text-sm text-slate-600">Máy chủ chưa cấu hình đăng nhập Google. Bạn có thể dùng thử, dữ liệu chỉ lưu trên thiết bị này.</p>
            <button className="btn-primary" onClick={onGuest}>
              Dùng thử
            </button>
          </>
        )}
        {error && <p className="max-w-xs text-center text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
