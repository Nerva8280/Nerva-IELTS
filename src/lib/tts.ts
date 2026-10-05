"use client";
// Text-to-speech via the browser's Web Speech API (free; quality depends on the device's voices).
import { getState } from "./store";

let voices: SpeechSynthesisVoice[] = [];

export function ttsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return Promise.resolve([]);
  voices = speechSynthesis.getVoices();
  if (voices.length) return Promise.resolve(voices);
  return new Promise((resolve) => {
    const done = () => {
      voices = speechSynthesis.getVoices();
      resolve(voices);
    };
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

const FEMALE = /female|zira|aria|jenny|libby|sonia|maisie|hazel|susan|samantha|karen|serena|moira|tessa|fiona|victoria|kate|emma|ava|allison|natasha|clara|michelle|olivia|amy|joanna|ana\b|nova|ivy|salli|kendra|kimberly/i;
const MALE = /\bmale|david|mark|guy|ryan|thomas|george|daniel|arthur|oliver|alex|fred|rishi|aaron|brian|christopher|eric|roger|william|james|matthew|liam|andrew|steffan|noah|joey|justin/i;

export function voiceGender(v: SpeechSynthesisVoice): "f" | "m" | "?" {
  if (FEMALE.test(v.name)) return "f";
  if (MALE.test(v.name)) return "m";
  return "?";
}

export function englishVoices(): SpeechSynthesisVoice[] {
  return voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
}

function quality(v: SpeechSynthesisVoice) {
  return /natural|neural|online|premium|enhanced/i.test(v.name) ? 3 : /google/i.test(v.name) ? 2 : v.localService ? 0 : 1;
}

export function pickVoice(gender: "f" | "m" = "f"): SpeechSynthesisVoice | undefined {
  const { settings } = getState();
  const chosen = gender === "f" ? settings.voiceF : settings.voiceM;
  const en = englishVoices();
  if (chosen) {
    const v = en.find((x) => x.name === chosen);
    if (v) return v;
  }
  const accent = settings.accent.toLowerCase();
  const sorted = [...en].sort((a, b) => {
    const s = (v: SpeechSynthesisVoice) =>
      (v.lang.toLowerCase().replace("_", "-") === accent ? 10 : 0) +
      (voiceGender(v) === gender ? 5 : voiceGender(v) === "?" ? 1 : 0) +
      quality(v);
    return s(b) - s(a);
  });
  return sorted[0];
}

let token = 0;

export function stopSpeaking() {
  token++;
  if (ttsSupported()) speechSynthesis.cancel();
}

// Chrome stops long utterances after ~15s, so text is spoken sentence by sentence.
function chunks(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text];
  return parts.map((p) => p.trim()).filter(Boolean);
}

export async function speak(text: string, opts: { gender?: "f" | "m"; rate?: number; onChunk?: (i: number) => void } = {}): Promise<void> {
  if (!ttsSupported()) return;
  if (!voices.length) await loadVoices();
  stopSpeaking();
  const my = ++token;
  const voice = pickVoice(opts.gender ?? "f");
  const rate = (opts.rate ?? 1) * getState().settings.rate;
  const list = chunks(text);
  for (let i = 0; i < list.length; i++) {
    if (my !== token) return;
    opts.onChunk?.(i);
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(list[i]);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? getState().settings.accent;
      u.rate = rate;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
  }
}

/** True while speak() for this call is still the latest request. */
export function currentToken() {
  return token;
}
