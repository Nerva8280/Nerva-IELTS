"use client";
import { useEffect, useRef, useState } from "react";
import { audioManifest, clearOffline, downloadAudio, downloadLessons, offlineStatus, offlineSupported } from "@/lib/offline";

type Status = Awaited<ReturnType<typeof offlineStatus>>;
type Job = { kind: "lessons" | "audio"; done: number; total: number };

/** Settings → Học offline: save lessons and audio on the device. */
export default function OfflineSection() {
  const [status, setStatus] = useState<Status>(null);
  const [audioMB, setAudioMB] = useState<number | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [err, setErr] = useState("");
  const abort = useRef<AbortController | null>(null);

  const refresh = () => void offlineStatus().then(setStatus);
  useEffect(() => {
    void offlineStatus().then(setStatus);
    audioManifest()
      .then((m) => setAudioMB(Math.round(Object.values(m.dirs).reduce((a, d) => a + d.bytes, 0) / 1e6)))
      .catch(() => {});
  }, []);

  async function run(kind: Job["kind"]) {
    setErr("");
    const ac = new AbortController();
    abort.current = ac;
    setJob({ kind, done: 0, total: 0 });
    // ask the browser not to clear saved files when space runs low
    void navigator.storage?.persist?.();
    try {
      await (kind === "lessons" ? downloadLessons : downloadAudio)((done, total) => setJob({ kind, done, total }), ac.signal);
    } catch {
      setErr("Tải bị gián đoạn. Kiểm tra mạng rồi bấm tải lại; phần đã tải vẫn được giữ.");
    }
    setJob(null);
    refresh();
  }

  if (typeof window !== "undefined" && !offlineSupported()) return <p className="muted text-sm">Trình duyệt này không hỗ trợ học offline.</p>;

  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-600">
        Lưu bài học vào máy để học khi không có mạng (trên máy bay, tàu xe…). Tiến độ học offline sẽ tự đồng bộ khi có mạng lại.
      </p>
      {status && (
        <div className="rounded-xl bg-slate-50 p-3">
          Đã lưu: <b>{status.pages}</b> trang bài học · <b>{status.audio}</b> file âm thanh
          {status.usedMB != null && <> · dùng khoảng {status.usedMB} MB</>}
        </div>
      )}
      {job ? (
        <div>
          <div className="mb-1 flex justify-between">
            <span>{job.kind === "lessons" ? "Đang tải bài học…" : "Đang tải âm thanh…"}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{job.total ? `${job.done}/${job.total}` : ""}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${job.total ? (job.done / job.total) * 100 : 2}%` }} />
          </div>
          <p className="muted mt-1">Giữ màn hình mở cho đến khi xong.</p>
          <button className="btn-ghost mt-1 w-full" onClick={() => abort.current?.abort()}>
            Dừng
          </button>
        </div>
      ) : (
        <div className="grid gap-2">
          <button className="btn-primary" onClick={() => run("lessons")}>
            📥 {status?.pages ? "Cập nhật bài học offline" : "Tải bài học để dùng offline"} (khoảng 7 MB)
          </button>
          <button className="btn-soft" onClick={() => run("audio")}>
            🔊 Tải toàn bộ âm thanh{audioMB ? ` (khoảng ${audioMB} MB, nên dùng Wi-Fi)` : ""}
          </button>
        </div>
      )}
      {err && <p className="text-rose-600">{err}</p>}
      <p className="muted">
        Không cần tải âm thanh vẫn được: file nào đã nghe sẽ tự lưu lại. Cần mạng: AI chấm Speaking/Writing, bài nghe VOA, giọng người thật từ từ điển.
      </p>
      {!job && (status?.pages || status?.audio) ? (
        <button
          className="text-xs text-slate-400 underline"
          onClick={() => {
            if (confirm("Xóa toàn bộ bài học và âm thanh đã lưu trên máy này? (Tiến độ học không bị ảnh hưởng)")) void clearOffline().then(refresh);
          }}
        >
          Xóa dữ liệu offline
        </button>
      ) : null}
    </div>
  );
}
