import type { CardRecord } from './types';

export type WordStatus = 'new' | 'learning' | 'known' | 'mastered';

/** Status of a word from its cards: by max FSRS stability (days). */
export function wordStatus(cards: CardRecord[]): WordStatus {
  const reviewed = cards.filter((c) => c.fsrs.reps > 0);
  if (reviewed.length === 0) return 'new';
  const s = Math.max(...reviewed.map((c) => c.fsrs.stability));
  if (s < 7) return 'learning';
  if (s <= 30) return 'known';
  return 'mastered';
}
