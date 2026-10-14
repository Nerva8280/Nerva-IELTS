// Word-level comparison for dictation: what the learner typed vs. the sentence they heard.

const CONTRACTIONS: Record<string, string> = {
  "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are", "he's": "he is", "she's": "she is",
  "it's": "it is", "that's": "that is", "there's": "there is", "what's": "what is", "who's": "who is", "where's": "where is",
  "i've": "i have", "you've": "you have", "we've": "we have", "they've": "they have", "i'll": "i will", "you'll": "you will",
  "he'll": "he will", "she'll": "she will", "we'll": "we will", "they'll": "they will", "it'll": "it will", "i'd": "i would",
  "you'd": "you would", "he'd": "he would", "she'd": "she would", "we'd": "we would", "they'd": "they would",
  "don't": "do not", "doesn't": "does not", "didn't": "did not", "can't": "cannot", "couldn't": "could not",
  "won't": "will not", "wouldn't": "would not", "shouldn't": "should not", "isn't": "is not", "aren't": "are not",
  "wasn't": "was not", "weren't": "were not", "haven't": "have not", "hasn't": "has not", "hadn't": "had not",
  "let's": "let us", "mustn't": "must not",
};

/** Lower-case words without punctuation, contractions expanded so "I'm" and "I am" both count. */
export function dictWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'€$%\s-]/g, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((w) => (CONTRACTIONS[w] ?? w).split(" "));
}

export interface DictationResult {
  words: { w: string; ok: boolean }[]; // target words, marked heard or missed
  extra: string[]; // typed words that are not in the sentence
  correct: number;
  total: number;
}

export function checkDictation(target: string, typed: string): DictationResult {
  const t = dictWords(target);
  const u = dictWords(typed);
  const dp = Array.from({ length: t.length + 1 }, () => new Array<number>(u.length + 1).fill(0));
  for (let i = t.length - 1; i >= 0; i--)
    for (let j = u.length - 1; j >= 0; j--) dp[i][j] = t[i] === u[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ok = new Array<boolean>(t.length).fill(false);
  const used = new Array<boolean>(u.length).fill(false);
  let i = 0;
  let j = 0;
  while (i < t.length && j < u.length) {
    if (t[i] === u[j]) {
      ok[i] = used[j] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const correct = ok.filter(Boolean).length;
  return { words: t.map((w, k) => ({ w, ok: ok[k] })), extra: u.filter((_, k) => !used[k]), correct, total: t.length };
}
