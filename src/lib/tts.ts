"use client";
// Text-to-speech via the browser's Web Speech API (free; quality depends on the device's voices).
import { getState } from "./store";
import { audioUrl, type VoiceId } from "./audio-key";

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
let current: { audio: HTMLAudioElement; finish: () => void } | null = null;
const missing = new Set<string>();

export function stopSpeaking() {
  token++;
  if (current) {
    current.audio.pause();
    current.finish();
    current = null;
  }
  if (ttsSupported()) speechSynthesis.cancel();
}

// Chrome stops long utterances after ~15s, so text is spoken sentence by sentence.
function chunks(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text];
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** The learner's chosen neural voice, plus the sentence voice of the same accent as a fallback. */
export function preferredVoices(): VoiceId[] {
  const v = getState().settings.voice ?? (getState().settings.accent === "en-US" ? "us-f" : "uk-f");
  const sentence: VoiceId = v.startsWith("us") ? "us-m" : "uk-f";
  return v === sentence ? [v] : [v, sentence];
}

/** Plays a URL; resolves "ended", "stopped" or "error" (e.g. file not generated). */
export function playUrl(url: string, rate = 1): Promise<"ended" | "stopped" | "error"> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.playbackRate = Math.max(0.5, Math.min(2, rate));
    audio.preservesPitch = true;
    let settled = false;
    const done = (r: "ended" | "stopped" | "error") => {
      if (settled) return;
      settled = true;
      if (current?.audio === audio) current = null;
      resolve(r);
    };
    current = { audio, finish: () => done("stopped") };
    audio.onended = () => done("ended");
    audio.onerror = () => done("error");
    audio.play().catch(() => done("error"));
  });
}

export interface SpeakOpts {
  voice?: VoiceId; // exact neural voice; otherwise the learner's preference
  gender?: "f" | "m"; // for the browser fallback
  rate?: number;
  browserOnly?: boolean;
  onChunk?: (i: number) => void;
}

export async function speak(text: string, opts: SpeakOpts = {}): Promise<void> {
  stopSpeaking();
  const my = token;
  const rate = (opts.rate ?? 1) * getState().settings.rate;
  if (!opts.browserOnly) {
    for (const v of opts.voice ? [opts.voice] : preferredVoices()) {
      const url = audioUrl(v, text);
      if (missing.has(url)) continue;
      const r = await playUrl(url, rate);
      if (my !== token || r !== "error") return;
      missing.add(url);
    }
  }
  if (!ttsSupported() || my !== token) return;
  if (!voices.length) await loadVoices();
  const voice = pickVoice(opts.gender ?? (opts.voice && /-m/.test(opts.voice) ? "m" : "f"));
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

// ---- Real human recordings (Wiktionary / Wikimedia Commons via dictionaryapi.dev) ----

const humanCache = new Map<string, Promise<{ uk?: string; us?: string; other?: string }>>();

export function humanAudio(word: string) {
  const key = word.toLowerCase().trim();
  if (!humanCache.has(key))
    humanCache.set(
      key,
      fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((entries: { phonetics?: { audio?: string }[] }[]) => {
          const urls = entries.flatMap((e) => e.phonetics ?? []).map((p) => p.audio).filter((u): u is string => !!u);
          return { uk: urls.find((u) => /-uk\.mp3$/.test(u)), us: urls.find((u) => /-us\.mp3$/.test(u)), other: urls.find((u) => !/-(uk|us)\.mp3$/.test(u)) };
        })
        .catch(() => ({})),
    );
  return humanCache.get(key)!;
}
