"use client";
import { useState } from "react";
import type { ShadowingSet } from "@/content/types";
import { markDone } from "@/lib/store";
import ShadowingPlayer from "@/components/ShadowingPlayer";
import PronSelfCheck from "@/components/PronSelfCheck";
import { DoneBanner, LevelChip, PageHeader } from "@/components/ui";

export default function ShadowingSetView({ set }: { set: ShadowingSet }) {
  const [done, setDone] = useState<number | null | undefined>(undefined);
  return (
    <div>
      <PageHeader title={set.title} back="/shadowing" right={<LevelChip level={set.level} />} />
      {done === undefined ? (
        <ShadowingPlayer
          sentences={set.sentences}
          onFinish={(avg) => {
            if (avg === null) markDone(set.id);
            else markDone(set.id, avg, 100);
            setDone(avg);
          }}
        />
      ) : (
        <>
        <PronSelfCheck source={set.id} />
        <DoneBanner>
          <div className="text-3xl">🎧</div>
          <div className="font-semibold">Hoàn thành bài shadowing!</div>
          {done !== null && <div className="muted">Độ khớp trung bình: {done}%</div>}
          <button className="btn-soft" onClick={() => setDone(undefined)}>
            Luyện lại
          </button>
        </DoneBanner>
        </>
      )}
    </div>
  );
}
