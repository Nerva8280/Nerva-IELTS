"use client";
import { useEffect, useState } from "react";
import type { PronItem, PronUnit } from "@/content/types";
import { getState, markDone } from "@/lib/store";
import { speakWord, stopSpeaking } from "@/lib/tts";
import { compareWords, listen, recognitionSupported, tokenize } from "@/lib/speech";
import { DoneBanner, LevelChip, PageHeader, ProgressBar, RichText, SpeakButton, useRecorder } from "@/components/ui";

const isQuiz = (it: PronItem) => it.kind !== "say";

/** Say something and check what speech recognition heard against the expected words. */
function SayCheck({ expect, avoid }: { expect: string; avoid?: string }) {
  const [state, setState] = useState<"idle" | "listening" | "done">("idle");
  const [heard, setHeard] = useState("");
  if (!recognitionSupported()) return null;

  async function go() {
    stopSpeaking();
    setState("listening");
    try {
      setHeard(await listen(getState().settings.accent).result);
    } catch {
      setHeard("");
    }
    setState("done");
  }

  const said = tokenize(heard);
  const target = tokenize(expect);
  const single = target.length === 1;
  const ok = single ? said.includes(target[0]) : compareWords(expect, heard).score >= 80;
  const confused = !!avoid && said.includes(tokenize(avoid)[0]);
  return (
    <div className="mt-2">
      <button className={state === "listening" ? "btn bg-rose-600 text-white" : "btn-ghost"} onClick={go} disabled={state === "listening"}>
        {state === "listening" ? "🎙 Đang nghe… hãy nói" : `🎙 Nói “${expect}”`}
      </button>
      {state === "done" && (
        <div className={`mt-2 rounded-xl p-2.5 text-sm ${ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
          {heard ? (
            <>
              Máy nghe được: “{heard}”. {ok ? "✓ Rõ ràng!" : confused ? `✗ Máy nghe thành “${avoid}”: luyện lại khẩu hình nhé.` : "✗ Chưa rõ, nghe mẫu rồi thử lại."}
            </>
          ) : (
            "Không nghe được giọng của bạn. Kiểm tra micro và thử lại."
          )}
        </div>
      )}
    </div>
  );
}

function Choice({ options, answer, picked, onPick }: { options: string[]; answer: number; picked: number | null; onPick: (k: number) => void }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {options.map((o, k) => (
        <button
          key={k}
          disabled={picked !== null}
          onClick={() => onPick(k)}
          className={`rounded-xl border-2 px-3 py-3 text-lg font-semibold transition disabled:pointer-events-none ${
            picked !== null && k === answer ? "border-emerald-500 bg-emerald-50" : picked === k ? "border-rose-400 bg-rose-50" : "border-slate-200 bg-white"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function ItemView({ it, onAnswer }: { it: PronItem; onAnswer: (correct: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  // For minimal pairs, the learner hears one of the two words at random.
  const [target] = useState(() => (Math.random() < 0.5 ? 0 : 1));
  const rec = useRecorder();

  const pick = (k: number, answer: number) => {
    setPicked(k);
    onAnswer(k === answer);
  };

  if (it.kind === "pair") {
    const words = [it.a, it.b];
    return (
      <div>
        <p className="muted">Nghe và chọn từ bạn nghe được:</p>
        <button className="btn-primary mt-2 w-full py-3" onClick={() => speakWord(words[target])}>
          ▶ Nghe
        </button>
        <Choice options={words} answer={target} picked={picked} onPick={(k) => pick(k, target)} />
        {picked !== null && (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
            {[0, 1].map((k) => (
              <div key={k} className="flex items-center gap-2">
                <SpeakButton text={words[k]} human />
                <b>{words[k]}</b>
                <span className="text-slate-500">{k === 0 ? it.aIpa : it.bIpa}</span>
              </div>
            ))}
            <div className="text-sm text-slate-600">Giờ hãy tự nói cả hai từ cho thật khác nhau:</div>
            <div className="flex flex-wrap gap-x-3">
              <SayCheck expect={it.a} avoid={it.b} />
              <SayCheck expect={it.b} avoid={it.a} />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (it.kind === "ending") {
    return (
      <div>
        <div className="text-center text-3xl font-bold">{it.word}</div>
        <div className="mt-2 flex justify-center">
          <SpeakButton text={it.word} label="Nghe" human />
        </div>
        <p className="muted mt-3">Đuôi của từ này đọc là âm nào?</p>
        <Choice options={it.options} answer={it.answer} picked={picked} onPick={(k) => pick(k, it.answer)} />
        {picked !== null && (
          <div className="mt-3 text-center text-slate-600">
            {it.word} <b>{it.ipa}</b>
            <SayCheck expect={it.word} />
          </div>
        )}
      </div>
    );
  }

  if (it.kind === "stress") {
    return (
      <div>
        <p className="muted">Âm tiết nào được nhấn mạnh?</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {it.syllables.map((syl, k) => (
            <button
              key={k}
              disabled={picked !== null}
              onClick={() => pick(k, it.stress)}
              className={`min-w-16 rounded-xl border-2 px-3 py-3 text-xl font-semibold disabled:pointer-events-none ${
                picked !== null && k === it.stress ? "border-emerald-500 bg-emerald-50" : picked === k ? "border-rose-400 bg-rose-50" : "border-slate-200 bg-white"
              }`}
            >
              {syl}
            </button>
          ))}
        </div>
        {picked !== null && (
          <div className="mt-4 text-center">
            <div className="text-2xl">
              {it.syllables.map((syl, k) => (
                <span key={k} className={k === it.stress ? "font-extrabold text-indigo-700" : "text-slate-500"}>
                  {k === it.stress ? syl.toUpperCase() : syl}
                </span>
              ))}
            </div>
            <div className="text-slate-500">{it.ipa}</div>
            <div className="mt-2 flex justify-center gap-2">
              <SpeakButton text={it.say ?? it.word} label="Nghe" human={!it.say} />
              <SpeakButton text={it.say ?? it.word} rate={0.65} label="Chậm" />
            </div>
            <SayCheck expect={it.word} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="text-xl font-semibold leading-relaxed">{it.text}</div>
      {it.ipa && <div className="mt-1 text-slate-500">{it.ipa}</div>}
      <p className="mt-2 rounded-xl bg-amber-50 p-2.5 text-sm text-amber-800">💡 {it.focusVi}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <SpeakButton text={it.text} label="Nghe" />
        <SpeakButton text={it.text} rate={0.7} label="Chậm" />
        {rec.recording ? (
          <button className="btn bg-rose-600 py-1.5 text-white" onClick={rec.stop}>
            ⏹ Dừng ghi
          </button>
        ) : (
          <button className="btn-ghost py-1.5" onClick={() => void rec.start()}>
            🎤 Ghi âm
          </button>
        )}
      </div>
      {rec.url && !rec.recording && <audio controls src={rec.url} className="mt-2 w-full" />}
      <SayCheck expect={it.text} />
    </div>
  );
}

export default function PronUnitView({ unit }: { unit: PronUnit }) {
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const quizTotal = unit.items.filter(isQuiz).length;
  const it = unit.items[i];

  useEffect(() => () => stopSpeaking(), []);

  function next() {
    stopSpeaking();
    if (i + 1 >= unit.items.length) {
      markDone(unit.id, score, quizTotal);
      setFinished(true);
      window.scrollTo({ top: 0 });
      return;
    }
    setI(i + 1);
    setAnswered(false);
  }

  if (!started)
    return (
      <div>
        <PageHeader title={unit.title} back="/practice" right={<LevelChip level={unit.level} />} />
        <div className="mb-3 text-2xl font-bold text-indigo-700">{unit.focus}</div>
        <div className="card">
          <RichText text={unit.explanationVi} />
        </div>
        <div className="card mt-3">
          <div className="mb-1 font-semibold">👄 Khẩu hình</div>
          <p className="leading-relaxed text-slate-700">{unit.mouthVi}</p>
        </div>
        <div className="card mt-3 bg-amber-50 ring-amber-200">
          <div className="mb-1 font-semibold">⚠️ Lỗi người Việt hay mắc</div>
          <p className="leading-relaxed text-slate-700">{unit.commonErrorVi}</p>
        </div>
        <button className="btn-primary mt-4 w-full py-3" onClick={() => setStarted(true)}>
          Bắt đầu luyện ({unit.items.length} bài)
        </button>
      </div>
    );

  if (finished)
    return (
      <div>
        <PageHeader title={unit.title} back="/practice" />
        <DoneBanner>
          <div className="text-3xl">👄</div>
          <div className="font-semibold">
            Nghe đúng {score}/{quizTotal} câu
          </div>
          <p className="muted">Nếu dưới 80%, hãy luyện lại bài này vào ngày mai. Nghe phân biệt được thì mới nói đúng được.</p>
          <button
            className="btn-soft"
            onClick={() => {
              setI(0);
              setScore(0);
              setAnswered(false);
              setFinished(false);
            }}
          >
            Luyện lại
          </button>
        </DoneBanner>
      </div>
    );

  return (
    <div>
      <PageHeader title={unit.focus} back="/practice" right={<span className="muted">{i + 1}/{unit.items.length}</span>} />
      <ProgressBar value={i / unit.items.length} className="mb-4" />
      <div className="card">
        <ItemView key={i} it={it} onAnswer={(ok) => {
          setAnswered(true);
          if (ok) setScore((x) => x + 1);
        }} />
      </div>
      <button className="btn-primary mt-4 w-full py-3" disabled={isQuiz(it) && !answered} onClick={next}>
        {i + 1 >= unit.items.length ? "Hoàn thành" : "Tiếp →"}
      </button>
    </div>
  );
}
