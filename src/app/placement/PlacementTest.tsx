"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { PlacementWord } from "@/content/types";
import { buildRound, LEVEL_INFO, score, shouldContinue, type RoundResult } from "@/lib/placement";
import { update, useAppState } from "@/lib/store";
import { todayStr } from "@/lib/dates";
import { LevelChip, ProgressBar } from "@/components/ui";

export default function PlacementTest({ words }: { words: PlacementWord[] }) {
  const router = useRouter();
  const state = useAppState();
  const [started, setStarted] = useState(false);
  const usedFakes = useRef(new Set<string>()).current;
  const [band, setBand] = useState(1);
  const [round, setRound] = useState<PlacementWord[]>([]);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<RoundResult[]>([]);
  const [finished, setFinished] = useState(false);

  function start() {
    usedFakes.clear();
    setResults([]);
    setFinished(false);
    setBand(1);
    setRound(buildRound(words, 1, usedFakes));
    setKnown(new Set());
    setStarted(true);
  }

  function nextRound() {
    const real = round.filter((w) => !w.pseudo);
    const fake = round.filter((w) => w.pseudo);
    const r: RoundResult = {
      band,
      realYes: real.filter((w) => known.has(w.word)).length,
      realTotal: real.length,
      fakeYes: fake.filter((w) => known.has(w.word)).length,
      fakeTotal: fake.length,
    };
    const all = [...results, r];
    setResults(all);
    if (shouldContinue(r)) {
      setBand(band + 1);
      setRound(buildRound(words, band + 1, usedFakes));
      setKnown(new Set());
      window.scrollTo({ top: 0 });
    } else setFinished(true);
  }

  const result = finished ? score(results) : null;

  function save() {
    if (!result) return;
    update((s) => {
      s.placement = { date: todayStr(), vocabSize: result.vocabSize, level: result.level, bands: result.bands, falseAlarm: result.falseAlarm };
      s.level = result.level;
    });
    router.replace(state.roadmap ? "/" : "/roadmap");
  }

  if (!started)
    return (
      <div className="pt-6">
        <h1 className="h1">Kiểm tra trình độ</h1>
        <div className="card mt-4 space-y-3 leading-relaxed">
          <p>Bài kiểm tra ước lượng <b>vốn từ vựng</b> của bạn, mất khoảng 3–5 phút.</p>
          <ul className="list-disc space-y-1 pl-5 text-slate-600">
            <li>Mỗi lượt có 10 từ, từ dễ đến khó dần.</li>
            <li>Chạm vào những từ bạn <b>biết nghĩa</b> (nhìn thấy là hiểu ngay).</li>
            <li>Có vài <b>từ giả</b> (không có thật) xen vào. Đừng đoán bừa, chọn từ giả sẽ bị trừ điểm.</li>
            <li>Bài dừng khi bạn biết ít hơn một nửa số từ trong lượt.</li>
          </ul>
        </div>
        <button className="btn-primary mt-6 w-full py-3 text-base" onClick={start}>
          Bắt đầu
        </button>
        {state.placement && (
          <button className="btn-ghost mt-3 w-full" onClick={() => router.back()}>
            Để sau
          </button>
        )}
      </div>
    );

  if (result) {
    const info = LEVEL_INFO[result.level];
    return (
      <div className="pt-6">
        <h1 className="h1">Kết quả</h1>
        <div className="card mt-4 text-center">
          <div className="muted">Vốn từ ước tính</div>
          <div className="text-4xl font-bold text-indigo-600">~{result.vocabSize.toLocaleString("vi-VN")} từ</div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <LevelChip level={result.level} />
            <span className="font-semibold">{info.name}</span>
          </div>
          <div className="muted mt-1">Tương đương IELTS khoảng {info.band}</div>
          <p className="mt-3 text-slate-600">{info.desc}</p>
        </div>
        <div className="card mt-4">
          <div className="h2 mb-3">Theo nhóm độ khó</div>
          {result.bands.map((b, i) => (
            <div key={i} className="mb-2 flex items-center gap-3 text-sm">
              <span className="w-16 text-slate-500">Nhóm {i + 1}</span>
              <ProgressBar value={b} className="flex-1" />
              <span className="w-10 text-right">{Math.round(b * 100)}%</span>
            </div>
          ))}
          {result.falseAlarm > 0.25 && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Bạn đã chọn khá nhiều từ giả, nên kết quả đã được điều chỉnh giảm. Lần sau chỉ chọn từ bạn chắc chắn biết nhé.
            </p>
          )}
        </div>
        <p className="muted mt-3">Hệ thống sẽ tự đề xuất lên level khi bạn học xong phần lớn nội dung của level hiện tại.</p>
        <button className="btn-primary mt-4 w-full py-3 text-base" onClick={save}>
          Lưu kết quả và tiếp tục
        </button>
        <button className="btn-ghost mt-3 w-full" onClick={start}>
          Làm lại
        </button>
      </div>
    );
  }

  return (
    <div className="pt-6">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="h1">Lượt {band}/6</h1>
        <span className="muted">Đã chọn {known.size}</span>
      </div>
      <ProgressBar value={(band - 1) / 6} />
      <p className="muted mt-4">Chạm vào các từ bạn biết nghĩa:</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {round.map((w) => {
          const on = known.has(w.word);
          return (
            <button
              key={w.word}
              onClick={() =>
                setKnown((k) => {
                  const n = new Set(k);
                  if (on) n.delete(w.word);
                  else n.add(w.word);
                  return n;
                })
              }
              className={`rounded-2xl border-2 px-3 py-4 text-lg font-semibold transition ${on ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-800"}`}
            >
              {on && "✓ "}
              {w.word}
            </button>
          );
        })}
      </div>
      <button className="btn-primary mt-6 w-full py-3 text-base" onClick={nextRound}>
        Tiếp tục
      </button>
    </div>
  );
}
