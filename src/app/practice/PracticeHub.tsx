"use client";
import Link from "next/link";
import { useState } from "react";
import { LEVELS } from "@/content/types";
import type { Catalog, ItemKind } from "@/lib/plan";
import { useAppState, type AppState } from "@/lib/store";
import { LevelChip, PageHeader } from "@/components/ui";

const TABS: { kind: Exclude<ItemKind, "shadowing">; label: string; icon: string }[] = [
  { kind: "pronunciation", label: "Phát âm", icon: "👄" },
  { kind: "grammar", label: "Ngữ pháp", icon: "📐" },
  { kind: "listening", label: "Listening", icon: "👂" },
  { kind: "reading", label: "Reading", icon: "📰" },
  { kind: "writing", label: "Writing", icon: "✍️" },
  { kind: "speaking", label: "Speaking", icon: "🗣️" },
];

export function ItemList({ catalog, kind, s }: { catalog: Catalog; kind: ItemKind; s: AppState }) {
  return (
    <div className="space-y-5">
      {LEVELS.map((level) => {
        const items = catalog[kind].filter((i) => i.level === level);
        if (!items.length) return null;
        return (
          <div key={level}>
            <div className="mb-2 flex items-center gap-2">
              <LevelChip level={level} />
              {level === s.level && <span className="text-xs font-semibold text-indigo-600">trình độ hiện tại</span>}
            </div>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
              {items.map((it) => {
                const d = s.done[it.id];
                return (
                  <Link key={it.id} href={`/${kind}/${it.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{it.title}</div>
                      {it.sub && <div className="text-xs text-slate-500">{it.sub}</div>}
                    </div>
                    {d ? (
                      <span className="chip bg-emerald-100 text-emerald-700">{d.total ? `${d.score}/${d.total}` : "✓"}</span>
                    ) : (
                      <span className="text-slate-300">→</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PracticeHub({ catalog }: { catalog: Catalog }) {
  const s = useAppState();
  const [tab, setTab] = useState<(typeof TABS)[number]["kind"]>("pronunciation");
  return (
    <div>
      <PageHeader title="Luyện tập" />
      <Link href="/talk" className="card mb-3 flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-violet-50 ring-indigo-200">
        <span className="text-3xl">💬</span>
        <div className="flex-1">
          <div className="font-semibold">Luyện phản xạ nói, có AI chấm</div>
          <div className="text-sm text-slate-600">24 chủ đề · trả lời bằng giọng nói · chấm theo 4 tiêu chí IELTS</div>
        </div>
        <span className="text-slate-400">→</span>
      </Link>
      <Link href="/mock" className="card mb-4 flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 ring-amber-200">
        <span className="text-3xl">🏁</span>
        <div className="flex-1">
          <div className="font-semibold">Mock test mini</div>
          <div className="text-sm text-slate-600">Listening + Reading theo trình độ, ước tính band điểm</div>
        </div>
        <span className="text-slate-400">→</span>
      </Link>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map((t) => (
          <button
            key={t.kind}
            onClick={() => setTab(t.kind)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${tab === t.kind ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <ItemList catalog={catalog} kind={tab} s={s} />
    </div>
  );
}
