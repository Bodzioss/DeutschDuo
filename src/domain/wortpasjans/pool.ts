import { wordStatus } from '../status';
import type { CardRecord, Word } from '../types';

/**
 * Personal ranking for solo boards (lower = preferred):
 * words due or still being learned first (most overdue first), then known words, then words not started yet in
 * introduction order. Roughly gives the spec's "mostly review, some known, a few new" mix.
 */
export function srsRank(words: Word[], cards: CardRecord[], now: Date): (w: Word) => number {
  const byWord = new Map<string, CardRecord[]>();
  for (const c of cards) byWord.set(c.wordId, [...(byWord.get(c.wordId) ?? []), c]);
  const nowMs = now.getTime();
  const rank = new Map<string, number>();
  words.forEach((w, i) => {
    const cs = (byWord.get(w.id) ?? []).filter((c) => c.fsrs.reps > 0);
    if (!cs.length) return rank.set(w.id, 2_000_000 + i);
    const due = Math.min(...cs.map((c) => Date.parse(c.fsrs.due)));
    const status = wordStatus(cs);
    if (due <= nowMs || status === 'learning') return rank.set(w.id, Math.max(0, Math.min(999_999, Math.round((due - nowMs) / 60_000) + 500_000)));
    rank.set(w.id, 1_000_000 + i);
  });
  return (w) => rank.get(w.id) ?? 3_000_000;
}
