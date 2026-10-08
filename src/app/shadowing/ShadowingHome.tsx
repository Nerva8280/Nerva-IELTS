"use client";
import { useState } from "react";
import type { Catalog } from "@/lib/plan";
import { useAppState } from "@/lib/store";
import { ItemList } from "../practice/PracticeHub";
import ShadowingPlayer, { splitSentences, type ShadowSentence } from "@/components/ShadowingPlayer";
import { PageHeader } from "@/components/ui";

// Free, reputable sources with natural speech that suit shadowing at different levels.
const RESOURCES = [
  { name: "BBC Learning English – 6 Minute English", url: "https://www.bbc.co.uk/learningenglish/english/features/6-minute-english", level: "A2–B2", note: "Hội thoại 6 phút giọng Anh, có transcript. Rất hợp shadowing hằng ngày." },
  { name: "VOA Learning English", url: "https://learningenglish.voanews.com/", level: "A2–B1", note: "Tin tức đọc chậm, rõ (giọng Mỹ), kèm lời." },
  { name: "ELLLO", url: "https://www.elllo.org/", level: "A1–B2", note: "Hàng nghìn đoạn hội thoại ngắn nhiều giọng, có transcript và quiz." },
  { name: "YouGlish", url: "https://youglish.com/", level: "Mọi trình độ", note: "Gõ một từ/cụm từ để nghe người bản xứ nói trong video thật." },
  { name: "IELTS Speaking mẫu – British Council / IELTS.org", url: "https://ielts.org/take-a-test/preparation-resources", level: "B1–C1", note: "Tài liệu & video bài thi Speaking thật, chuẩn format." },
  { name: "TED / TED-Ed", url: "https://www.ted.com/talks", level: "B2–C1", note: "Bài nói học thuật, bật phụ đề tiếng Anh. Tốt cho Part 3 & Listening Part 4." },
  { name: "Rachel's English (YouTube)", url: "https://www.youtube.com/@rachelsenglish", level: "Mọi trình độ", note: "Phát âm, nối âm, ngữ điệu Mỹ, có bài shadowing chậm." },
  { name: "English with Lucy (YouTube)", url: "https://www.youtube.com/@EnglishwithLucy", level: "A2–B2", note: "Phát âm giọng Anh chuẩn, từ vựng thông dụng." },
];

export default function ShadowingHome({ catalog }: { catalog: Catalog }) {
  const s = useAppState();
  const [custom, setCustom] = useState("");
  const [customSet, setCustomSet] = useState<ShadowSentence[] | null>(null);

  return (
    <div>
      <PageHeader title="Shadowing" />
      <div className="card mb-4 text-sm leading-relaxed">
        <div className="mb-1 font-semibold">Cách shadowing hiệu quả (5–7 phút/ngày)</div>
        <ol className="list-decimal space-y-0.5 pl-5 text-slate-600">
          <li>Nghe câu mẫu 2–3 lần ở tốc độ 0.6–0.8×, chú ý trọng âm và chỗ lên/xuống giọng.</li>
          <li>Đọc to đồng thời với giọng mẫu (nói đuổi theo, trễ ~0.5 giây).</li>
          <li>Bấm “Nói theo & chấm” để xem từ nào máy chưa nghe rõ.</li>
          <li>Ghi âm và so với giọng mẫu, rồi tăng lên tốc độ 1×.</li>
        </ol>
      </div>

      <h2 className="h2 mb-1">🗣️ Giọng người bản xứ</h2>
      <p className="muted mb-3">Câu do người Mỹ bản xứ đọc (Tatoeba). Nên ưu tiên luyện các bài này để bắt chước ngữ điệu tự nhiên.</p>
      <ItemList catalog={{ ...catalog, shadowing: catalog.shadowing.filter((x) => x.id.startsWith("nsh-")) }} kind="shadowing" s={s} />

      <h2 className="h2 mb-1 mt-8">🤖 Giọng AI (Anh & Mỹ, 4 giọng)</h2>
      <p className="muted mb-3">Câu mẫu theo chủ đề IELTS, đọc bằng giọng AI: rõ nhưng ngữ điệu chưa tự nhiên bằng người thật.</p>
      <ItemList catalog={{ ...catalog, shadowing: catalog.shadowing.filter((x) => !x.id.startsWith("nsh-")) }} kind="shadowing" s={s} />

      <h2 className="h2 mb-2 mt-6">Tự nhập đoạn văn để shadowing</h2>
      {customSet ? (
        <div className="card">
          <ShadowingPlayer sentences={customSet} onFinish={() => setCustomSet(null)} />
          <button className="btn-ghost mt-3 w-full" onClick={() => setCustomSet(null)}>
            Đóng
          </button>
        </div>
      ) : (
        <div className="card">
          <textarea
            className="input min-h-28"
            placeholder="Dán transcript từ BBC, TED, bài mẫu IELTS… vào đây"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
          <button className="btn-primary mt-2 w-full" disabled={splitSentences(custom).length === 0} onClick={() => setCustomSet(splitSentences(custom))}>
            Bắt đầu shadowing ({splitSentences(custom).length} câu)
          </button>
        </div>
      )}

      <h2 className="h2 mb-2 mt-6">Nguồn shadowing tham khảo</h2>
      <div className="space-y-2">
        {RESOURCES.map((r) => (
          <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="card block hover:ring-indigo-300">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{r.name}</span>
              <span className="chip shrink-0 bg-slate-100 text-slate-600">{r.level}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{r.note}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
