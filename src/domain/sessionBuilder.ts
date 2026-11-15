import { cardId, type CardRecord, type Direction, type ReviewRecord, type Word } from './types';

export interface SessionItem {
  cardId: string;
  wordId: string;
  direction: Direction;
  isNew: boolean;
}

export const MAX_REVIEWS_PER_DAY = 150;
export const REQUEUE_WINDOW_MS = 10 * 60_000;
const REVIEWS_PER_NEW = 3;

export function buildSession(i: {
  cards: CardRecord[];
  words: Word[];
  reviewsToday: ReviewRecord[];
  now: Date;
  newPerDay: number;
  maxReviews?: number;
}): SessionItem[] {
  const max = i.maxReviews ?? MAX_REVIEWS_PER_DAY;
  const reviewedToday = i.reviewsToday.filter((r) => !r.wasNew).length;
  const introducedToday = new Set(i.reviewsToday.filter((r) => r.wasNew && r.cardId.endsWith(':de_en')).map((r) => r.cardId)).size;

  const nowMs = i.now.getTime();
  const reviews: SessionItem[] = i.cards
    .filter((c) => new Date(c.fsrs.due).getTime() <= nowMs)
    .sort((a, b) => a.fsrs.due.localeCompare(b.fsrs.due))
    .slice(0, Math.max(0, max - reviewedToday))
    .map((c) => ({ cardId: c.id, wordId: c.wordId, direction: c.direction, isNew: false }));

  const started = new Set(i.cards.filter((c) => c.direction === 'de_en').map((c) => c.wordId));
  const fresh: SessionItem[] = i.words
    .filter((w) => !started.has(w.id))
    .slice(0, Math.max(0, i.newPerDay - introducedToday))
    .map((w) => ({ cardId: cardId(w.id, 'de_en'), wordId: w.id, direction: 'de_en', isNew: true }));

  const out: SessionItem[] = [];
  let n = 0;
  reviews.forEach((r, idx) => {
    out.push(r);
    if ((idx + 1) % REVIEWS_PER_NEW === 0 && n < fresh.length) out.push(fresh[n++]);
  });
  return out.concat(fresh.slice(n));
}

/** A card answered in this session comes back at the end of the queue if it is due again soon. */
export function shouldRequeue(card: CardRecord, now: Date): boolean {
  return new Date(card.fsrs.due).getTime() <= now.getTime() + REQUEUE_WINDOW_MS;
}
