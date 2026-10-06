// Pre-generated neural voice files live at /audio/<voice>/<hash>.mp3 (made by tools/audio).
// Shared by the browser and the generator, so keep this file free of imports and TS-only syntax.

export const VOICES = {
  "uk-f": { kokoro: "bf_emma", label: "🇬🇧 Nữ" },
  "uk-m": { kokoro: "bm_george", label: "🇬🇧 Nam" },
  "us-f": { kokoro: "af_heart", label: "🇺🇸 Nữ" },
  "us-m": { kokoro: "am_michael", label: "🇺🇸 Nam" },
  // extra voices so different speakers in a listening script sound different
  "us-f2": { kokoro: "af_bella", label: "🇺🇸 Nữ 2" },
  "uk-m2": { kokoro: "bm_fable", label: "🇬🇧 Nam 2" },
} as const;

export type VoiceId = keyof typeof VOICES;
export const MAIN_VOICES: VoiceId[] = ["uk-f", "uk-m", "us-f", "us-m"];
// Voices generated for ordinary sentences (examples, answers…): the best-rated voice of each accent
// (Kokoro grades: af_heart A, bf_emma B-, am_michael C+, bm_george C).
export const SENTENCE_VOICES: VoiceId[] = ["uk-f", "us-f"];
// Single words: Kokoro garbles very short inputs; af_heart (cut from "Listen. <word>.") is the
// only voice that reads isolated words reliably, so it is the default for words.
export const WORD_VOICE: VoiceId = "us-f";

export function normText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/** FNV-1a 32-bit hash of the normalised text, as 8 hex chars. */
export function audioKey(text: string): string {
  const s = normText(text);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function audioUrl(voice: VoiceId, text: string): string {
  return `/audio/${voice}/${audioKey(text)}.mp3`;
}

/** Voice for each line of a listening script: each distinct speaker gets their own voice. */
export function scriptVoices(script: { speaker: string; gender: "f" | "m" }[]): VoiceId[] {
  const pools: Record<"f" | "m", VoiceId[]> = { f: ["uk-f", "us-f", "us-f2"], m: ["uk-m", "us-m", "uk-m2"] };
  const assigned = new Map<string, VoiceId>();
  const used = { f: 0, m: 0 };
  return script.map((l) => {
    let v = assigned.get(l.speaker);
    if (!v) {
      v = pools[l.gender][used[l.gender]++ % 3];
      assigned.set(l.speaker, v);
    }
    return v;
  });
}
