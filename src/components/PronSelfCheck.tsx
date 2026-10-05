"use client";
import { useState } from "react";
import { update, useAppState } from "@/lib/store";
import { todayStr } from "@/lib/dates";

// Simplified, paraphrased version of the IELTS Speaking "Pronunciation" criterion, split into the
// four things an examiner listens for. Levels map to bands 5–8.
const CRITERIA: { name: string; levels: [string, string, string, string] }[] = [
  {
    name: "Dễ hiểu",
    levels: [
      "Người nghe phải cố gắng; nhiều từ khó hiểu",
      "Nhìn chung hiểu được, nhưng đôi lúc vài từ sai làm khó nghe",
      "Dễ hiểu; lỗi ít và không gây hiểu nhầm",
      "Dễ hiểu suốt bài; giọng Việt ảnh hưởng rất ít",
    ],
  },
  {
    name: "Âm từng từ (âm cuối, -s/-ed, âm khó)",
    levels: [
      "Thường bỏ âm cuối và đuôi -s/-ed",
      "Đôi khi bỏ âm cuối hoặc -s/-ed",
      "Hầu hết âm cuối rõ, thỉnh thoảng sót",
      "Âm cuối và các âm khó đều rõ ràng",
    ],
  },
  {
    name: "Trọng âm & nhấn câu",
    levels: [
      "Nhấn đều mọi từ hoặc sai trọng âm nhiều",
      "Trọng âm từ phần lớn đúng, nhấn câu chưa rõ",
      "Nhấn đúng từ quan trọng trong câu",
      "Dùng nhấn giọng linh hoạt để làm rõ ý",
    ],
  },
  {
    name: "Ngữ điệu, nối âm, nhịp",
    levels: [
      "Đều đều, ngắt từng từ một",
      "Có lên xuống giọng nhưng chưa đều; ngắt cụm chưa tự nhiên",
      "Ngắt cụm hợp lý, có nối âm, lên/xuống giọng đúng",
      "Nhịp tự nhiên, ngữ điệu linh hoạt theo ý muốn nói",
    ],
  },
];

/** After recording, the learner rates their own recording against the four criteria. */
export default function PronSelfCheck({ source }: { source: string }) {
  const s = useAppState();
  const [picks, setPicks] = useState<(number | undefined)[]>([]);
  const [saved, setSaved] = useState(false);
  const done = picks.filter((p) => p !== undefined).length === CRITERIA.length;
  const band = done ? Math.round(((picks as number[]).reduce((a, b) => a + b + 5, 0) / CRITERIA.length) * 2) / 2 : null;
  const history = (s.pronChecks ?? []).slice(-5);

  return (
    <div className="card mt-4">
      <div className="h2">Tự chấm phát âm theo tiêu chí IELTS</div>
      <p className="muted mt-1">
        Nghe lại bản ghi âm của bạn, so với giọng mẫu, rồi chọn mức đúng nhất cho mỗi tiêu chí. Chấm trung thực để thấy tiến bộ thật.
      </p>
      <div className="mt-3 space-y-4">
        {CRITERIA.map((c, i) => (
          <div key={c.name}>
            <div className="mb-1.5 text-sm font-semibold">
              {i + 1}. {c.name}
            </div>
            <div className="grid gap-1.5">
              {c.levels.map((l, k) => (
                <button
                  key={k}
                  onClick={() => {
                    setSaved(false);
                    setPicks((p) => Object.assign([...p], { [i]: k }));
                  }}
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-left text-sm ${picks[i] === k ? "border-indigo-500 bg-indigo-50" : "border-slate-200"}`}
                >
                  <span className="chip shrink-0 bg-slate-100 text-slate-600">Band {k + 5}</span>
                  <span>{l}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {band !== null && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-indigo-50 p-3">
          <div>
            <div className="text-sm text-slate-600">Band phát âm tự ước lượng</div>
            <div className="text-2xl font-bold text-indigo-700">{band.toFixed(1)}</div>
          </div>
          <button
            className="btn-primary"
            disabled={saved}
            onClick={() => {
              update((st) => {
                st.pronChecks ??= [];
                st.pronChecks.push({ date: todayStr(), band, source });
              });
              setSaved(true);
            }}
          >
            {saved ? "Đã lưu ✓" : "Lưu"}
          </button>
        </div>
      )}
      {history.length > 0 && (
        <div className="mt-3 text-xs text-slate-500">
          Các lần trước: {history.map((h) => `${h.date.slice(5)}: ${h.band}`).join(" · ")}
        </div>
      )}
    </div>
  );
}
