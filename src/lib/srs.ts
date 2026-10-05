// Simplified SM-2 spaced repetition.
import { addDays } from "./dates";

export interface SrsCard {
  due: string;
  interval: number; // days
  ease: number;
  reps: number;
  lapses: number;
  known?: boolean; // learner said they already knew it
}

export type Grade = 0 | 1 | 2 | 3; // again, hard, good, easy

export function newCard(today: string): SrsCard {
  return { due: today, interval: 0, ease: 2.5, reps: 0, lapses: 0 };
}

export function knownCard(today: string): SrsCard {
  return { due: addDays(today, 30), interval: 30, ease: 2.7, reps: 3, lapses: 0, known: true };
}

export function review(card: SrsCard, grade: Grade, today: string): SrsCard {
  const c = { ...card };
  if (grade === 0) {
    c.lapses += 1;
    c.reps = 0;
    c.interval = 0; // see again today
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.due = today;
    return c;
  }
  c.reps += 1;
  if (c.reps === 1) c.interval = grade === 3 ? 3 : 1;
  else if (c.reps === 2) c.interval = grade === 1 ? 2 : grade === 3 ? 6 : 4;
  else c.interval = Math.round(c.interval * (grade === 1 ? 1.2 : grade === 3 ? c.ease * 1.3 : c.ease));
  c.interval = Math.max(1, Math.min(c.interval, 365));
  if (grade === 1) c.ease = Math.max(1.3, c.ease - 0.15);
  if (grade === 3) c.ease += 0.15;
  c.due = addDays(today, c.interval);
  return c;
}

export function intervalLabel(card: SrsCard, grade: Grade, today: string): string {
  const next = review(card, grade, today);
  if (grade === 0) return "<1 ngày";
  return next.interval === 1 ? "1 ngày" : `${next.interval} ngày`;
}

export function isDue(card: SrsCard, today: string): boolean {
  return card.due <= today;
}
